import type { ChatLLM } from "../../config/llm.js";
import { readFile } from "node:fs/promises";
import type {
  FlowExecutionResult,
  ValidationResult,
  CrossFlowRule,
} from "../../types/OrchestrationTypes.js";

/**
 * CrossFlowValidator
 * Intelligent validator that uses LLM to check consistency across multiple flows
 */
export class CrossFlowValidator {
  private llm: ChatLLM;

  constructor(llm: ChatLLM) {
    this.llm = llm;
  }

  /**
   * Validate cross-flow consistency using LLM
   * @param flowResults - Map of flow execution results
   * @param rules - Array of cross-flow validation rules
   * @returns Array of validation results
   */
  async validate(
    flowResults: Map<string, FlowExecutionResult>,
    rules: CrossFlowRule[],
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    if (!rules || rules.length === 0) {
      return results;
    }

    for (const rule of rules) {
      try {
        // Get the source flow result
        const sourceResult = flowResults.get(rule.sourceFlow);

        if (!sourceResult || !sourceResult.outputs.intermediateJson) {
          results.push({
            validationType: "crossFlow",
            passed: false,
            details: `Source flow "${rule.sourceFlow}" not found or has no output`,
            warnings: [`Cannot validate rule: ${rule.name}`],
          });
          continue;
        }

        // Load source JSON
        const sourceJsonContent = await readFile(
          sourceResult.outputs.intermediateJson,
          "utf-8",
        );
        const sourceData = JSON.parse(sourceJsonContent);

        // Extract the field to check
        const sourceFieldValue = sourceData[rule.sourceField];

        if (!Array.isArray(sourceFieldValue)) {
          results.push({
            validationType: "crossFlow",
            passed: false,
            details: `Source field "${rule.sourceField}" is not an array in flow "${rule.sourceFlow}"`,
            warnings: [`Expected array, got: ${typeof sourceFieldValue}`],
          });
          continue;
        }

        // Collect target flow results
        const targetResults = this.collectTargetResults(
          flowResults,
          rule.targetFlows,
          sourceFieldValue,
        );

        // Build prompt and call LLM
        const prompt = this.buildCrossFlowPrompt(
          rule,
          sourceFieldValue,
          targetResults,
        );

        // Parse LLM response
        const validation = this.parseValidationResponse(
          await this.llm.complete(prompt),
        );

        results.push({
          validationType: "crossFlow",
          passed: validation.valid,
          details: validation.reasoning,
          warnings:
            validation.missingOperations.length > 0
              ? validation.missingOperations
              : undefined,
          llmReasoning: validation.reasoning,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({
          validationType: "crossFlow",
          passed: false,
          details: `Cross-flow validation failed for rule "${rule.name}": ${errorMsg}`,
          warnings: [`Error during cross-flow validation: ${errorMsg}`],
        });
      }
    }

    return results;
  }

  /**
   * Collect results from target flows for each operation
   */
  private collectTargetResults(
    flowResults: Map<string, FlowExecutionResult>,
    targetFlows: string[],
    operations: string[],
  ): Array<{ operation: string; flow: string; found: boolean }> {
    const results: Array<{ operation: string; flow: string; found: boolean }> =
      [];

    for (const targetFlow of targetFlows) {
      for (const operation of operations) {
        // Try to find result for this operation in this flow
        // Flow key format: "flowName-operationName"
        const key = `${targetFlow}-${operation}`;
        const result = flowResults.get(key);

        results.push({
          operation,
          flow: targetFlow,
          found: !!result && result.success,
        });
      }
    }

    return results;
  }

  /**
   * Build cross-flow validation prompt for LLM
   */
  private buildCrossFlowPrompt(
    rule: CrossFlowRule,
    operations: string[],
    targetResults: Array<{ operation: string; flow: string; found: boolean }>,
  ): string {
    return `You are a cross-flow data consistency validator.

VALIDATION RULE: ${rule.description}
RULE TYPE: ${rule.rule}

SOURCE FLOW: ${rule.sourceFlow}
SOURCE FIELD: ${rule.sourceField}
OPERATIONS DISCOVERED: ${operations.join(", ")}

TARGET FLOWS: ${rule.targetFlows.join(", ")}

TARGET FLOW RESULTS:
${JSON.stringify(targetResults, null, 2)}

INSTRUCTIONS:
- Verify that ALL operations from the source flow were successfully processed by ALL target flows
- Identify any missing operations (found: false)
- Determine if the cross-flow consistency is valid

RESPOND ONLY with a JSON object in this exact format (no additional text):
{
  "valid": true or false,
  "reasoning": "Brief explanation of your assessment",
  "missingOperations": ["Array of operations that were not processed, or empty array if all were processed"]
}`;
  }

  /**
   * Parse LLM validation response
   */
  private parseValidationResponse(response: string): {
    valid: boolean;
    reasoning: string;
    missingOperations: string[];
  } {
    try {
      // Extract JSON from response (handle potential markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in LLM response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        valid: Boolean(parsed.valid),
        reasoning: String(parsed.reasoning || "No reasoning provided"),
        missingOperations: Array.isArray(parsed.missingOperations)
          ? parsed.missingOperations.map(String)
          : [],
      };
    } catch (error) {
      console.error("Failed to parse LLM response:", response);
      return {
        valid: false,
        reasoning: `Failed to parse LLM response: ${error instanceof Error ? error.message : String(error)}`,
        missingOperations: [],
      };
    }
  }
}
