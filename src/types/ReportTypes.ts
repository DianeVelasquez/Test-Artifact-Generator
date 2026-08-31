import type { ValidationResult } from "./OrchestrationTypes.js";

/**
 * Summary of the entire orchestration execution
 */
export interface OrchestrationSummary {
  success: boolean;
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  totalExecutionTime: number;
}

/**
 * Report for a single orchestration step
 */
export interface StepReport {
  stepName: string;
  description?: string;
  success: boolean;
  attempts: number;
  startTime: number;
  endTime: number;
  executionTime: number;
  flowCount: number;
  successfulFlows: number;
  failedFlows: number;
  flows: FlowReport[];
  validations: ValidationReport;
  error?: string;
}

/**
 * Report for a single flow execution
 */
export interface FlowReport {
  flowName: string;
  success: boolean;
  attempt: number;
  executionTime: number;
  outputs: {
    intermediateJson?: string;
    artifacts?: string[];
  };
  metrics: {
    filesRead: number;
    fieldsExtracted: number;
    artifactsGenerated: number;
    llmTokens?: number;
  };
  error?: string;
}

/**
 * Validation summary for a step
 */
export interface ValidationReport {
  total: number;
  passed: number;
  failed: number;
  byType: {
    fileExistence?: ValidationTypeReport;
    schemaCompliance?: ValidationTypeReport;
    contentQuality?: ValidationTypeReport;
    crossFlow?: ValidationTypeReport;
  };
  details: ValidationResult[];
}

/**
 * Report for a specific validation type
 */
export interface ValidationTypeReport {
  total: number;
  passed: number;
  failed: number;
}

/**
 * Aggregated metrics across all steps and flows
 */
export interface OrchestrationMetrics {
  totalFlows: number;
  totalLLMCalls: number;
  totalLLMTokens: number;
  totalFilesRead: number;
  totalFieldsExtracted: number;
  totalArtifactsGenerated: number;
}

/**
 * Error report with context
 */
export interface ErrorReport {
  stepName?: string;
  flowName?: string;
  phase?: string;
  error: string;
  timestamp: number;
}

/**
 * Warning report with context
 */
export interface WarningReport {
  stepName?: string;
  flowName?: string;
  validationType?: string;
  warning: string;
  timestamp: number;
}

/**
 * Complete orchestration report
 * This is the comprehensive output of the Master Orchestrator
 */
export interface OrchestrationReport {
  summary: OrchestrationSummary;
  steps: StepReport[];
  flows: FlowReport[];
  validations: {
    total: number;
    passed: number;
    failed: number;
    byType: {
      fileExistence?: ValidationTypeReport;
      schemaCompliance?: ValidationTypeReport;
      contentQuality?: ValidationTypeReport;
      crossFlow?: ValidationTypeReport;
    };
  };
  metrics: OrchestrationMetrics;
  errors: ErrorReport[];
  warnings: WarningReport[];
  timestamp: number;
  version: string;
}
