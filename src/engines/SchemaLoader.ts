import { readFile } from "node:fs/promises";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SchemaWithHintsSchema,
  type SchemaWithHints,
  type LoadedSchema,
} from "../types/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../..");

/**
 * Carga y valida schemas desde specs/schemas/
 */
export class SchemaLoader {
  /**
   * Carga un schema desde un path absoluto o relativo
   */
  async loadSchema(schemaPath: string): Promise<LoadedSchema> {
    try {
      // Resolver path absoluto
      const resolvedPath = schemaPath.startsWith("/")
        ? schemaPath
        : resolve(PROJECT_ROOT, "specs", schemaPath);

      const content = await readFile(resolvedPath, "utf-8");
      const parsed = JSON.parse(content);

      // Validar con Zod
      const validated = SchemaWithHintsSchema.parse(parsed);

      // Validar que tenga sourceHints
      if (!validated.sourceHints) {
        throw new Error("Schema must have 'sourceHints' field");
      }

      // Extraer data o scenarios
      const data = validated.data || validated.scenarios || {};

      return {
        sourceHints: validated.sourceHints,
        data,
        raw: validated,
        path: resolvedPath,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to load schema from ${schemaPath}: ${error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Obtiene el nombre del schema desde su path
   */
  getSchemaName(schemaPath: string): string {
    return basename(schemaPath, ".json");
  }

  /**
   * Valida que un schema tenga sourceHints válidos
   */
  validateSourceHints(schema: SchemaWithHints): boolean {
    const hints = schema.sourceHints;

    // Validaciones básicas
    if (!hints.description || hints.description.trim() === "") {
      throw new Error("sourceHints must have a non-empty description");
    }

    if (!hints.fileExtensions || hints.fileExtensions.length === 0) {
      throw new Error("sourceHints must have at least one fileExtension");
    }

    if (!hints.priority || hints.priority.length === 0) {
      throw new Error("sourceHints must have at least one priority source");
    }

    // Validar que fileExtensions empiecen con "."
    for (const ext of hints.fileExtensions) {
      if (!ext.startsWith(".")) {
        throw new Error(
          `File extension "${ext}" must start with a dot (e.g., ".json")`,
        );
      }
    }

    return true;
  }
}

/**
 * Helper function para cargar un schema
 */
export async function loadSchema(schemaPath: string): Promise<LoadedSchema> {
  const loader = new SchemaLoader();
  return loader.loadSchema(schemaPath);
}
