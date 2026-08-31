import Ajv2020 from "ajv/dist/2020.js";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  FlowExecutionResult,
  ValidationResult,
} from "../../types/OrchestrationTypes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../../..");

/**
 * SchemaValidator
 * Deterministic validator that validates JSON files against their schemas using Ajv
 */
export class SchemaValidator {
  private ajv: any;
  private schemaCache: Map<string, any>;

  constructor() {
    this.ajv = new (Ajv2020 as any)({
      allErrors: true,
      verbose: true,
      strict: false, // Allow additional properties not in schema
    });
    this.schemaCache = new Map();
  }

  /**
   * Validate that all intermediate JSON files comply with their schemas
   * @param flowResults - Map of flow execution results
   * @returns Array of validation results
   */
  async validate(
    flowResults: Map<string, FlowExecutionResult>,
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const [flowName, result] of flowResults) {
      // Skip flows that didn't complete successfully or have no JSON output
      if (!result.success || !result.outputs.intermediateJson) {
        continue;
      }

      try {
        // Load the JSON file
        const jsonContent = await readFile(
          result.outputs.intermediateJson,
          "utf-8",
        );
        const data = JSON.parse(jsonContent);

        // Determine and load the schema for this flow
        const schema = await this.loadSchemaForFlow(flowName);

        if (!schema) {
          results.push({
            validationType: "schemaCompliance",
            flowName,
            passed: false,
            details: `Schema not found for flow: ${flowName}`,
            warnings: ["Unable to determine schema path for this flow"],
          });
          continue;
        }

        // Validate the JSON against the schema
        const valid = this.ajv.validate(schema, data);

        if (valid) {
          results.push({
            validationType: "schemaCompliance",
            flowName,
            passed: true,
            details: `JSON complies with schema`,
          });
        } else {
          const errorMessages = this.ajv.errors?.map(
            (err: any) =>
              `${err.instancePath || "root"} ${err.message} (${JSON.stringify(err.params)})`,
          );

          results.push({
            validationType: "schemaCompliance",
            flowName,
            passed: false,
            details: `Schema validation failed: ${this.ajv.errorsText()}`,
            warnings: errorMessages,
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({
          validationType: "schemaCompliance",
          flowName,
          passed: false,
          details: `Failed to validate schema: ${errorMsg}`,
          warnings: [`Error during validation: ${errorMsg}`],
        });
      }
    }

    return results;
  }

  /**
   * Load the schema for a given flow
   * Caches schemas to avoid re-loading
   *
   * @param flowName - Name of the flow (may include operation suffix like "operationDiscovery-CreateUser")
   * @returns Parsed JSON schema or null if not found
   */
  private async loadSchemaForFlow(flowName: string): Promise<any | null> {
    // Extract base flow name (remove operation suffix if present)
    const baseFlowName = this.extractBaseFlowName(flowName);

    // Map flow names to schema files
    const schemaMap: Record<string, string> = {
      serviceMetadata: "schemas/service.json",
      operationDiscovery: "schemas/operation.json",
      bddScenarios: "schemas/bddScenarios.json",
    };

    const schemaRelativePath = schemaMap[baseFlowName];
    if (!schemaRelativePath) {
      return null;
    }

    // Check cache first
    if (this.schemaCache.has(schemaRelativePath)) {
      return this.schemaCache.get(schemaRelativePath);
    }

    try {
      const schemaPath = resolve(PROJECT_ROOT, "specs", schemaRelativePath);
      const schemaContent = await readFile(schemaPath, "utf-8");
      const schema = JSON.parse(schemaContent);

      // Cache the schema
      this.schemaCache.set(schemaRelativePath, schema);

      return schema;
    } catch (error) {
      console.error(
        `Failed to load schema ${schemaRelativePath}:`,
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  /**
   * Extract the base flow name from a full flow name
   * Example: "operationDiscovery-CreateUser" → "operationDiscovery"
   *
   * @param flowName - Full flow name
   * @returns Base flow name
   */
  private extractBaseFlowName(flowName: string): string {
    // Remove operation suffix (e.g., "-CreateUser")
    const parts = flowName.split("-");
    return parts[0];
  }
}
