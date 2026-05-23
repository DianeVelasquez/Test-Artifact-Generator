import { access, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  FlowDefinition,
  ResolvedSources,
  Sources,
} from "../types/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../..");

/**
 * Resuelve y valida rutas de fuentes de datos
 */
export class SourceResolver {
  /**
   * Resuelve paths relativos a absolutos
   */
  async resolveSources(sources: Sources): Promise<ResolvedSources> {
    const resolved: ResolvedSources = {};

    if (sources.build) {
      resolved.build = this.resolvePathAbsolute(sources.build);
    }

    if (sources.release) {
      resolved.release = this.resolvePathAbsolute(sources.release);
    }

    if (sources.repo) {
      resolved.repo = this.resolvePathAbsolute(sources.repo);
    }

    return resolved;
  }

  /**
   * Valida que las fuentes existan en el filesystem
   */
  async validateSources(sources: ResolvedSources): Promise<void> {
    const errors: string[] = [];

    for (const [sourceType, sourcePath] of Object.entries(sources)) {
      if (!sourcePath) continue;

      try {
        await access(sourcePath);
      } catch {
        errors.push(`${sourceType}: "${sourcePath}" does not exist`);
        continue;
      }

      // Validar tipo (archivo o directorio)
      try {
        const stats = await stat(sourcePath);

        if (sourceType === "repo" && !stats.isDirectory()) {
          errors.push(
            `${sourceType}: "${sourcePath}" must be a directory, but is a file`,
          );
        } else if (sourceType !== "repo" && !stats.isFile()) {
          errors.push(
            `${sourceType}: "${sourcePath}" must be a file, but is a directory`,
          );
        }
      } catch (error) {
        errors.push(
          `${sourceType}: unable to stat "${sourcePath}" - ${error}`,
        );
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Source validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
      );
    }
  }

  /**
   * Resuelve un path a absoluto
   */
  private resolvePathAbsolute(path: string): string {
    return path.startsWith("/") ? path : resolve(PROJECT_ROOT, path);
  }

  /**
   * Resuelve y valida fuentes para un flujo completo
   */
  async resolveAndValidateFlowSources(
    flowDef: FlowDefinition,
  ): Promise<ResolvedSources> {
    const resolved = await this.resolveSources(flowDef.sources);
    await this.validateSources(resolved);
    return resolved;
  }
}

/**
 * Helper function para resolver fuentes
 */
export async function resolveSources(
  sources: Sources,
): Promise<ResolvedSources> {
  const resolver = new SourceResolver();
  return resolver.resolveSources(sources);
}

/**
 * Helper function para validar fuentes
 */
export async function validateSources(
  sources: ResolvedSources,
): Promise<void> {
  const resolver = new SourceResolver();
  return resolver.validateSources(sources);
}
