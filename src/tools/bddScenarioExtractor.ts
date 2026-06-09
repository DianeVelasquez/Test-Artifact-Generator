import type { ChatLLM } from "../config/llm.js";
import type { FieldExtractionSource } from "./fieldExtractor.js";
import type { ResolvedFlowDefinition } from "../types/index.js";
import { SpringBootEndpointExtractorTool } from "./springBootEndpointExtractor.js";

// The structure of the data this tool is expected to extract
export interface BddExtractionData {
  scenariosBddModular?: any[];
  scenariosBddIntegration?: any[];
}

export interface BddScenarioExtractorInput {
  repoFiles: FieldExtractionSource[];
  flowDefinition: ResolvedFlowDefinition;
  schema: any; // The schema for BDD scenarios
}

export interface BddScenarioExtractorOutput {
  success: boolean;
  data?: BddExtractionData;
  error?: string;
  rawResponse?: string;
}

/**
 * BddScenarioExtractorTool
 * A specialized tool that uses an LLM to extract BDD scenarios for a specific operation.
 */
export class BddScenarioExtractorTool {
  name = "BddScenarioExtractor";
  description = "Extracts BDD scenarios from .feature and .java files for a single operation.";

  private springBootEndpointExtractor = new SpringBootEndpointExtractorTool();

  constructor(private llm: ChatLLM) {}

  private buildRestFallbackScenarios(operationName: string, repoFiles: FieldExtractionSource[]): BddExtractionData | null {
    const endpoint = this.springBootEndpointExtractor
      .extract(repoFiles)
      .find((candidate) => candidate.operationName === operationName);

    if (!endpoint) {
      return null;
    }

    const request = `${endpoint.httpMethod} ${endpoint.path}`;
    const successScenario = {
      scenery: `${operationName}Success`,
      request,
      description: `Given a valid request for ${request} when the service is invoked then the API returns a successful response.`,
      given: `a valid request for ${request}`,
      when: `the client invokes ${request}`,
      then: "the API returns a successful response",
      responseCode: endpoint.httpMethod === "POST" ? 201 : 200,
      responseStatus: "Success",
    };

    const validationScenario = {
      scenery: `${operationName}InvalidRequest`,
      request,
      description: `Given an invalid request for ${request} when the service is invoked then the API returns a validation error.`,
      given: `an invalid request for ${request}`,
      when: `the client invokes ${request}`,
      then: "the API returns a validation error",
      responseCode: 400,
      responseStatus: "BusinessException",
    };

    return {
      scenariosBddModular: [successScenario, validationScenario],
      scenariosBddIntegration: [successScenario],
    };
  }

  private buildPrompt(
    repoFiles: FieldExtractionSource[],
    schema: any,
    operationName: string
  ): string {
    const fileContents = repoFiles
      .map(f => {
        try {
            const content = f.data || '';
            if (content.trim()) {
              return `---\nFile: ${f.description}\n\
\
${content.substring(0, 2000)}\
\
---
`;
            }
            return null;
        } catch (e) {
            console.error(`[BddExtractor ERROR] Failed inside file map for object:`, f);
            throw e;
        }
      })
      .filter(Boolean)
      .join('\n');

    const targetSchema = { ...schema };
    delete targetSchema.operationName; 

    return `You are a specialized BDD (Behavior-Driven Development) data extraction system.

## CONTEXT
You are extracting BDD scenarios for ONE SINGLE operation named: **${operationName}**

## TASK
Your ONLY task is to analyze the provided source files and extract all scenarios that belong to the **${operationName}** operation. Populate the fields in the JSON schema below based on what you find.

## SOURCE FILES
Here are the contents of the relevant files found in the repository:
${fileContents}

## TARGET SCHEMA
Populate this exact JSON structure. Do not add extra fields.

\
\
${JSON.stringify(targetSchema, null, 2)}
\
\

## INSTRUCTIONS
1.  Read all scenarios from the source files.
2.  Filter them to keep ONLY the ones related to the **${operationName}** operation.
3.  Populate the 'scenariosBddModular' and 'scenariosBddIntegration' arrays according to the schema.
4.  If no scenarios are found for this operation, return empty arrays for 'scenariosBddModular' and 'scenariosBddIntegration'.
5.  **Finding the \`request\` path**: For SOAP/XML scenarios, construct the relative path to its XML message file. The path typically follows this pattern: \`messages/{operationName}/{scenario_status}/request.xml\`. For Spring Boot REST scenarios without request fixture files, use the HTTP method and relative endpoint path as the request value, for example \`POST /api/users\`.
6.  **Spelling Correction**: Always use the correct spelling "BusinessException" for any business-related exception statuses. Do NOT use "BussinesException".

## OUTPUT FORMAT
Your response MUST be a single, valid JSON object that matches the TARGET SCHEMA. Do not add explanations or markdown.
`;
  }

  private parseLLMResponse(response: string): BddExtractionData | null {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("BddScenarioExtractorTool: No JSON object found in LLM response. Raw:", response);
        return null;
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;

    } catch (error) {
      console.error("BddScenarioExtractorTool: Failed to parse LLM response:", error);
      console.error("Raw response was:", response);
      return null;
    }
  }

  async run(input: BddScenarioExtractorInput): Promise<BddScenarioExtractorOutput> {
    const {
      repoFiles,
      flowDefinition,
      schema,
    } = input;

    const operationName = flowDefinition.operationName;
    if (!operationName) {
      return { success: false, error: "BddScenarioExtractorTool requires an operationName in the flowDefinition context." };
    }

    try {
      const fallbackData = this.buildRestFallbackScenarios(operationName, repoFiles);
      if (fallbackData) {
        return {
          success: true,
          data: fallbackData,
          rawResponse: JSON.stringify(fallbackData),
        };
      }

      const prompt = this.buildPrompt(repoFiles, schema, operationName);
      
      const rawResponse = await this.llm.complete(prompt, {
        temperature: 0.0,
        maxTokens: 4096,
      });
      const data = this.parseLLMResponse(rawResponse);

      if (!data) {
        return { success: false, error: "Failed to parse a valid JSON object from the LLM response.", rawResponse };
      }

      return {
        success: true,
        data,
        rawResponse,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
