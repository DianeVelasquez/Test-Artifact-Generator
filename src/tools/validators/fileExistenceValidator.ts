import { access } from "node:fs/promises";
import type {
  FlowExecutionResult,
  ValidationResult,
} from "../../types/OrchestrationTypes.js";

/**
 * FileExistenceValidator
 * Deterministic validator that checks if expected files exist on disk
 */
export class FileExistenceValidator {
  /**
   * Validate that all expected output files exist
   * @param flowResults - Map of flow execution results
   * @returns Array of validation results
   */
  async validate(
    flowResults: Map<string, FlowExecutionResult>,
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const [flowName, result] of flowResults) {
      // Skip flows that didn't complete successfully
      if (!result.success) {
        continue;
      }

      // Validate intermediate JSON exists
      if (result.outputs.intermediateJson) {
        const jsonExists = await this.fileExists(
          result.outputs.intermediateJson,
        );

        results.push({
          validationType: "fileExistence",
          flowName,
          passed: jsonExists,
          details: jsonExists
            ? `Intermediate JSON exists: ${result.outputs.intermediateJson}`
            : `Intermediate JSON missing: ${result.outputs.intermediateJson}`,
          warnings: jsonExists ? undefined : ["File not found on disk"],
        });
      }

      // Validate artifacts exist
      if (result.outputs.artifacts && result.outputs.artifacts.length > 0) {
        for (const artifactPath of result.outputs.artifacts) {
          const artifactExists = await this.fileExists(artifactPath);

          results.push({
            validationType: "fileExistence",
            flowName,
            passed: artifactExists,
            details: artifactExists
              ? `Artifact exists: ${artifactPath}`
              : `Artifact missing: ${artifactPath}`,
            warnings: artifactExists
              ? undefined
              : [`Artifact file not found: ${artifactPath}`],
          });
        }
      }
    }

    return results;
  }

  /**
   * Check if a file exists on disk
   * @param filePath - Path to check
   * @returns True if file exists, false otherwise
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
