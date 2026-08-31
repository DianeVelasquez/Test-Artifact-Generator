import { z } from "zod";

/**
 * Retry Policy Configuration
 * Defines how many times to retry a failed step and with what backoff
 */
export const RetryPolicySchema = z.object({
  enabled: z.boolean().default(true),
  maxAttempts: z.number().min(1).max(10).default(3),
  backoffMs: z.number().min(0).default(1000),
  retryOn: z.array(z.string()).optional(), // Specific flows to retry
});

export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

/**
 * Validation Configuration
 * Defines which validations to run after step execution
 */
export const ValidationConfigSchema = z.object({
  fileExistence: z.boolean().default(true),
  schemaCompliance: z.boolean().default(true),
  contentQuality: z.boolean().default(false), // LLM-based (expensive)
  crossFlowValidation: z.boolean().default(false), // LLM-based
});

export type ValidationConfig = z.infer<typeof ValidationConfigSchema>;

/**
 * Dynamic Scope Configuration
 * Enables forEach loops over arrays (e.g., operations)
 */
export const DynamicScopeSchema = z.object({
  forEach: z.string(), // Variable name holding array
  variable: z.string(), // Variable name for each iteration
});

export type DynamicScope = z.infer<typeof DynamicScopeSchema>;

/**
 * OnSuccess Action Configuration
 * Actions to execute after successful step completion
 */
export const OnSuccessActionSchema = z.object({
  extractOperations: z
    .object({
      sourceFile: z.string(),
      field: z.string(),
      storeAs: z.string(),
    })
    .optional(),
});

export type OnSuccessAction = z.infer<typeof OnSuccessActionSchema>;

/**
 * Orchestration Step Schema
 * Defines a single step in the orchestration workflow
 */
export const OrchestrationStepSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  flows: z.array(z.string()), // Flow names to execute in this step
  executionMode: z.enum(["sequential", "parallel"]).default("sequential"),
  retryPolicy: RetryPolicySchema.optional(),
  validation: ValidationConfigSchema.optional(),
  dynamicScope: DynamicScopeSchema.optional(),
  onSuccess: OnSuccessActionSchema.optional(),
});

export type OrchestrationStep = z.infer<typeof OrchestrationStepSchema>;

/**
 * Cross-Flow Validation Rule
 * Defines rules to validate consistency across multiple flows
 */
export const CrossFlowRuleSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  sourceFlow: z.string(),
  sourceField: z.string(),
  targetFlows: z.array(z.string()),
  rule: z.enum([
    "all-operations-processed",
    "no-missing-operations",
    "consistent-operation-names",
  ]),
});

export type CrossFlowRule = z.infer<typeof CrossFlowRuleSchema>;

/**
 * Validation Rules Container
 * Groups all validation rules
 */
export const ValidationRulesSchema = z.object({
  crossFlowRules: z.array(CrossFlowRuleSchema).optional(),
});

export type ValidationRules = z.infer<typeof ValidationRulesSchema>;

/**
 * Execution Context
 * Maintains state across orchestration steps
 */
export interface ExecutionContext {
  variables: Map<string, any>; // Runtime variables (e.g., discoveredOperations)
  stepResults: Map<string, StepResult>;
  startTime: number;
}

/**
 * Flow Execution Result
 * Result of executing a single flow
 */
export interface FlowExecutionResult {
  flowName: string;
  success: boolean;
  attempt: number;
  outputs: {
    intermediateJson?: string;
    artifacts?: string[];
  };
  error?: string;
  metrics: {
    executionTime: number;
    llmTokens?: number;
    filesRead: number;
    fieldsExtracted: number;
    artifactsGenerated: number;
  };
}

/**
 * Validation Result
 * Result of a single validation check
 */
export interface ValidationResult {
  validationType:
    | "fileExistence"
    | "schemaCompliance"
    | "contentQuality"
    | "crossFlow";
  passed: boolean;
  flowName?: string;
  details: string;
  warnings?: string[];
  llmReasoning?: string; // For LLM-based validations
}

/**
 * Step Result
 * Result of executing a single orchestration step
 */
export interface StepResult {
  stepName: string;
  success: boolean;
  flowResults: Map<string, FlowExecutionResult>;
  validationResults: ValidationResult[];
  attempts: number;
  error?: string;
  startTime: number;
  endTime: number;
}

/**
 * Master Orchestrator Configuration
 */
export interface MasterOrchestratorConfig {
  configPath?: string;
  enableIntelligentValidation?: boolean; // Toggle LLM validations
}
