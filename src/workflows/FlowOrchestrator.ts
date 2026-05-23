import type { ChatLLM } from "../config/llm.js";
import { FlowConfigLoader } from "../engines/FlowConfigLoader.js";
import { SourceResolver } from "../engines/SourceResolver.js";
import { FlowExecutor, type FlowResult } from "./FlowExecutor.js";
import type { FlowDefinition } from "../types/index.js";

export interface OrchestrationResult {
  success: boolean;
  totalFlows: number;
  successfulFlows: number;
  failedFlows: number;
  results: FlowResult[];
  totalExecutionTime: number;
}

/**
 * FlowOrchestrator - Orquesta la ejecución de múltiples flujos.
 * Esta clase es responsable de cargar configuraciones de flujo, resolver sus rutas
 * y coordinar su ejecución a través del FlowExecutor.
 * Ha sido refactorizada para servir como un motor de ejecución de flujos para el MasterOrchestratorAgent,
 * eliminando la lógica de grafo de dependencias y ejecución dinámica que ahora maneja el agente principal.
 */
export class FlowOrchestrator {
  private flowConfigLoader: FlowConfigLoader;
  private sourceResolver: SourceResolver;
  private flowExecutor: FlowExecutor;

  constructor(llm: ChatLLM, configPath?: string) {
    this.flowConfigLoader = new FlowConfigLoader(configPath);
    this.sourceResolver = new SourceResolver();
    this.flowExecutor = new FlowExecutor(llm);
  }

  /**
   * Resuelve placeholders en los paths de la definición de un flujo usando un contexto.
   * Ejemplo: Reemplaza {operationName} con un valor real.
   * @param definition - La definición original del flujo.
   * @param context - Un objeto clave-valor para reemplazar los placeholders.
   * @returns Una nueva definición de flujo con los paths resueltos.
   */
  private _resolvePlaceholders(
    definition: FlowDefinition,
    context?: Record<string, any>,
  ): FlowDefinition {
    if (!context || Object.keys(context).length === 0) {
      return definition;
    }

    let defString = JSON.stringify(definition);

    for (const [key, value] of Object.entries(context)) {
      if (typeof value === "string" || typeof value === "number") {
        const regex = new RegExp(`{${key}}`, "g");
        defString = defString.replace(regex, String(value));
      }
    }

    return JSON.parse(defString) as FlowDefinition;
  }

  /**
   * Ejecuta todos los flujos habilitados en la configuración.
   * Este método ahora itera sobre los flujos y los ejecuta uno por uno.
   * La lógica compleja de dependencias y paralelismo ahora es manejada por el MasterOrchestratorAgent.
   */
  async executeAllFlows(): Promise<OrchestrationResult> {
    const startTime = Date.now();
    console.log("\n[FlowOrchestrator] Executing all enabled flows (legacy mode)...");

    await this.flowConfigLoader.load();
    const enabledFlows = this.flowConfigLoader.getEnabledFlows();

    if (enabledFlows.length === 0) {
      return { success: true, totalFlows: 0, successfulFlows: 0, failedFlows: 0, results: [], totalExecutionTime: 0 };
    }

    const allResults: FlowResult[] = [];
    for (const { name } of enabledFlows) {
      try {
        const result = await this.executeFlow(name);
        allResults.push(result);
        if (!result.success) {
          console.error(`\n[FlowOrchestrator] Halting execution due to failure in flow: ${name}`);
          break; // Detener en el primer fallo
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error(`\n[FlowOrchestrator] Fatal error executing flow ${name}: ${errorMsg}`);
        allResults.push({ flowName: name, success: false, error: errorMsg, stats: { executionTime: 0, filesRead: 0, fieldsExtracted: 0, artifactsGenerated: 0 } });
        break; // Detener en el primer error fatal
      }
    }

    const totalExecutionTime = Date.now() - startTime;
    const successfulFlows = allResults.filter((r) => r.success).length;
    const failedFlows = allResults.length - successfulFlows;

    return {
      success: failedFlows === 0,
      totalFlows: allResults.length,
      successfulFlows,
      failedFlows,
      results: allResults,
      totalExecutionTime,
    };
  }

  /**
   * Ejecuta un flujo específico por nombre, aplicando un contexto dinámico.
   * @param flowName - El nombre del flujo a ejecutar.
   * @param context - Un contexto opcional para resolver placeholders en la configuración del flujo.
   */
  async executeFlow(flowName: string, context?: Record<string, any>): Promise<FlowResult> {
    const contextIdentifier = context ? ` (context: ${JSON.stringify(context)})` : "";
    console.log(`\n[FlowOrchestrator] Executing flow: ${flowName}${contextIdentifier}`);

    // Cargar la configuración si aún no se ha hecho
    if (!this.flowConfigLoader.isLoaded()) {
      await this.flowConfigLoader.load();
    }

    const originalFlowDef = this.flowConfigLoader.getFlow(flowName);
    if (!originalFlowDef) {
      throw new Error(`Flow "${flowName}" not found.`);
    }

    if (originalFlowDef.enabled === false) {
      throw new Error(`Flow "${flowName}" is disabled.`);
    }
    
    // 1. Resolver placeholders usando el contexto dinámico
    const contextualizedFlowDef = this._resolvePlaceholders(originalFlowDef, context);
    
    // 2. Validar fuentes (usando la definición con placeholders resueltos)
    console.log(`  [Validating] Sources for ${flowName}...`);
    await this.sourceResolver.resolveAndValidateFlowSources(contextualizedFlowDef);
    console.log(`  [OK] Sources validated for ${flowName}`);

    // 3. Resolver paths a absolutos
    const resolvedFlow = this.flowConfigLoader.resolveFlowPaths(
      flowName,
      contextualizedFlowDef,
    );

    // Asignar un nombre único al flujo y el contexto de operación
    if (context?.operationName) {
      resolvedFlow.name = `${flowName}-${context.operationName}`;
      resolvedFlow.operationName = context.operationName;
    }

    // 4. Ejecutar el flujo con la configuración final
    const result = await this.flowExecutor.execute(resolvedFlow);

    return result;
  }
}

/**
 * Helper function para ejecutar todos los flujos (legacy)
 */
export async function executeAllFlows(
  llm: ChatLLM,
  configPath?: string,
): Promise<OrchestrationResult> {
  const orchestrator = new FlowOrchestrator(llm, configPath);
  return orchestrator.executeAllFlows();
}

/**
 * Helper function para ejecutar un flujo específico
 */
export async function executeFlow(
  flowName: string,
  llm: ChatLLM,
  configPath?: string,
): Promise<FlowResult> {
  const orchestrator = new FlowOrchestrator(llm, configPath);
  return orchestrator.executeFlow(flowName);
}
