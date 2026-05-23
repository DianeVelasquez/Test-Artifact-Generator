import { JsonBuilderTool } from "../tools/jsonBuilder.js";
import type { ExtractedField } from "../tools/fieldExtractor.js";
import type { ResolvedFlowDefinition } from "../types/index.js";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export interface WriterAgentInput {
  schema: any;
  extractedFields: ExtractedField[];
  flowDefinition: ResolvedFlowDefinition;
}

export interface WriteResult {
  success: boolean;
  outputPath: string;
  json: string;
  writtenFiles?: string[];
  validationErrors?: string[];
}

/**
 * WriterAgent - Construye y escribe el JSON intermedio
 * Escribe solo el campo 'data' sin sourceHints
 */
export class WriterAgent {
  private jsonBuilder: JsonBuilderTool;

  constructor() {
    this.jsonBuilder = new JsonBuilderTool();
  }

  async write(input: WriterAgentInput): Promise<WriteResult> {
    return this.writeSingleOutput(input);
  }

  /**
   * Writes a single output JSON file (normal mode)
   */
  private async writeSingleOutput(
    input: WriterAgentInput,
  ): Promise<WriteResult> {
    const { schema, extractedFields, flowDefinition } = input;
    const outputPath = flowDefinition.resolvedOutputPaths.intermediate;

    console.log("\n[WriterAgent] Building output JSON...");
    console.log(`[Flow] ${flowDefinition.name}`);
    console.log("[Output] path:", outputPath);

    // Asegurar que el directorio de salida exista
    const outputDir = dirname(outputPath);
    await mkdir(outputDir, { recursive: true });

    // Convert extracted fields to the format expected by JsonBuilder
    const fieldValues = extractedFields.map((field) => ({
      fieldName: field.fieldName,
      value: field.value,
    }));

    console.log(
      `[Building] Assembling ${fieldValues.length} fields into JSON structure...`,
    );

    // DEBUG: Log extracted field names to diagnose empty operations.json
    console.log("[DEBUG] Extracted fields:");
    fieldValues.forEach((fv, idx) => {
      const valuePreview = typeof fv.value === "object"
        ? JSON.stringify(fv.value).substring(0, 100) + "..."
        : String(fv.value).substring(0, 100);
      console.log(`  [${idx + 1}] ${fv.fieldName}: ${valuePreview}`);
    });

    // Build and write the JSON
    const result = await this.jsonBuilder.run({
      schema,
      fieldValues,
      outputPath,
      pretty: true,
    });

    if (!result.success) {
      console.error("[ERROR] Failed to build JSON:", result.error);
      if (result.validationErrors && result.validationErrors.length > 0) {
        console.error("Validation errors:");
        result.validationErrors.forEach((err) => console.error(`  - ${err}`));
      }

      return {
        success: false,
        outputPath,
        json: "",
        validationErrors: result.validationErrors,
      };
    }

    console.log("[OK] JSON built and validated successfully");
    console.log(`[Output] written to: ${result.outputPath}`);

    return {
      success: true,
      outputPath: result.outputPath!,
      json: result.json!,
    };
  }
}
