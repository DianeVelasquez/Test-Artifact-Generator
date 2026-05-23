import { readFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FlowConfigSchema,
  type FlowConfig,
  type FlowDefinition,
  type ResolvedFlowDefinition,
} from "../types/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../..");

/**
 * Carga y valida el archivo flow-configuration.json
 */
export class FlowConfigLoader {
  private configPath: string;
  private config: FlowConfig | null = null;

  constructor(configPath?: string) {
    this.configPath =
      configPath || join(PROJECT_ROOT, "specs/flow-configuration.json");
  }

  /**
   * Carga el archivo de configuración de flujos
   */
  async load(): Promise<FlowConfig> {
    try {
      const content = await readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(content);

      // Validar con Zod
      const validated = FlowConfigSchema.parse(parsed);

      this.config = validated;
      return validated;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to load flow configuration from ${this.configPath}: ${error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Verifica si la configuración ya ha sido cargada.
   */
  isLoaded(): boolean {
    return this.config !== null;
  }

  /**
   * Obtiene la configuración completa
   */
  getConfig(): FlowConfig {
    if (!this.config) {
      throw new Error("Configuration not loaded. Call load() first.");
    }
    return this.config;
  }

  /**
   * Obtiene un flujo específico por nombre
   */
  getFlow(flowName: string): FlowDefinition | undefined {
    if (!this.config) {
      throw new Error("Configuration not loaded. Call load() first.");
    }
    return this.config.flows[flowName];
  }

  /**
   * Obtiene todos los flujos habilitados
   */
  getEnabledFlows(): Array<{ name: string; definition: FlowDefinition }> {
    if (!this.config) {
      throw new Error("Configuration not loaded. Call load() first.");
    }

    return Object.entries(this.config.flows)
      .filter(([_, def]) => def.enabled !== false)
      .map(([name, definition]) => ({ name, definition }));
  }

  /**
   * Obtiene todos los nombres de flujos
   */
  getFlowNames(): string[] {
    if (!this.config) {
      throw new Error("Configuration not loaded. Call load() first.");
    }
    return Object.keys(this.config.flows);
  }

  /**
   * Resuelve paths relativos a absolutos para un flujo
   */
  resolveFlowPaths(
    flowName: string,
    flowDef: FlowDefinition,
  ): ResolvedFlowDefinition {
    const specsDir = join(PROJECT_ROOT, "specs");

    return {
      name: flowName,
      description: flowDef.description,
      enabled: flowDef.enabled,
      dependsOn: flowDef.dependsOn,
      schema: flowDef.schema,
      templates: flowDef.templates,
      sources: {
        build: flowDef.sources.build
          ? resolve(PROJECT_ROOT, flowDef.sources.build)
          : undefined,
        release: flowDef.sources.release
          ? resolve(PROJECT_ROOT, flowDef.sources.release)
          : undefined,
        repo: flowDef.sources.repo
          ? resolve(PROJECT_ROOT, flowDef.sources.repo)
          : undefined,
      },
      output: flowDef.output,
      resolvedSchemaPath: resolve(specsDir, flowDef.schema),
      resolvedOutputPaths: {
        intermediate: resolve(PROJECT_ROOT, flowDef.output.intermediate),
        artifacts: resolve(PROJECT_ROOT, flowDef.output.artifacts),
      },
      inputDependencies: flowDef.inputDependencies,
      dynamicExecution: flowDef.dynamicExecution,
    };
  }
}

/**
 * Helper function para cargar configuración de flujos
 */
export async function loadFlowConfig(
  configPath?: string,
): Promise<FlowConfig> {
  const loader = new FlowConfigLoader(configPath);
  return loader.load();
}
