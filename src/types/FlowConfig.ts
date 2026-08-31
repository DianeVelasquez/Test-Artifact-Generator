import { z } from "zod";
import {
  OrchestrationStepSchema,
  ValidationRulesSchema,
} from "./OrchestrationTypes.js";

/**
 * Schema de validación para sourceHints en schemas
 */
export const SourceHintsSchema = z.object({
  description: z.string(),
  fileExtensions: z.array(z.string()),
  directories: z.array(z.string()).optional(),
  patterns: z.array(z.string()).optional(),
  priority: z.array(z.enum(["build", "release", "repo"])),
});

export type SourceHints = z.infer<typeof SourceHintsSchema>;

/**
 * Schema de validación para fuentes de datos
 */
export const SourcesSchema = z.object({
  build: z.string().optional(),
  release: z.string().optional(),
  repo: z.string().optional(),
});

export type Sources = z.infer<typeof SourcesSchema>;

/**
 * Schema de validación para outputs de un flujo
 */
export const OutputConfigSchema = z.object({
  intermediate: z.string(),
  artifacts: z.string(),
});

export type OutputConfig = z.infer<typeof OutputConfigSchema>;

/**
 * Schema de validación para dynamic execution
 * Permite que un flow se ejecute N veces basado en una lista de operaciones
 */
export const DynamicExecutionSchema = z.object({
  enabled: z.boolean(),
  sourceList: z.string(),
  sourceField: z.string(),
  description: z.string().optional(),
});

export type DynamicExecution = z.infer<typeof DynamicExecutionSchema>;

/**
 * Schema de validación para definición de un flujo individual
 */
export const FlowDefinitionSchema = z.object({
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  dependsOn: z.array(z.string()).default([]),
  schema: z.string(),
  templates: z.array(z.string()),
  sources: SourcesSchema,
  output: OutputConfigSchema,
  inputDependencies: z.record(z.string()).optional(),
  dynamicExecution: DynamicExecutionSchema.optional(),
});

export type FlowDefinition = z.infer<typeof FlowDefinitionSchema>;

/**
 * Schema de validación para flow-configuration.json completo
 */
export const FlowConfigSchema = z.object({
  $schema: z.string().optional(),
  version: z.string().optional(),
  description: z.string().optional(),

  // NEW: Orchestration steps for Master Orchestrator
  orchestrationSteps: z.array(OrchestrationStepSchema).optional(),

  // NEW: Validation rules (cross-flow validation, etc.)
  validation: ValidationRulesSchema.optional(),

  flows: z.record(z.string(), FlowDefinitionSchema),
});

export type FlowConfig = z.infer<typeof FlowConfigSchema>;

/**
 * Fuentes resueltas con paths absolutos
 */
export interface ResolvedSources {
  build?: string;
  release?: string;
  repo?: string;
}

/**
 * Definición de flujo con paths resueltos
 */
export interface ResolvedFlowDefinition extends Omit<FlowDefinition, "sources"> {
  name: string;
  dependsOn: string[];
  operationName?: string;
  sources: ResolvedSources;
  resolvedSchemaPath: string;
  resolvedOutputPaths: {
    intermediate: string;
    artifacts: string;
  };
  inputDependencies?: Record<string, string>;
  dynamicExecution?: DynamicExecution;
}
