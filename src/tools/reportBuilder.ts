import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  OrchestrationReport,
  OrchestrationSummary,
  StepReport,
  FlowReport,
  ValidationReport,
  ValidationTypeReport,
  OrchestrationMetrics,
  ErrorReport,
  WarningReport,
} from "../types/ReportTypes.js";
import type {
  StepResult,
  FlowExecutionResult,
  ValidationResult,
} from "../types/OrchestrationTypes.js";

/**
 * MetricsCollector
 * Tracks and aggregates metrics during orchestration
 */
export class MetricsCollector {
  private metrics: Map<string, number>;

  constructor() {
    this.metrics = new Map();
    this.metrics.set("totalFlows", 0);
    this.metrics.set("totalLLMCalls", 0);
    this.metrics.set("totalLLMTokens", 0);
    this.metrics.set("totalFilesRead", 0);
    this.metrics.set("totalFieldsExtracted", 0);
    this.metrics.set("totalArtifactsGenerated", 0);
  }

  /**
   * Increment a metric by a value
   */
  increment(metric: string, value: number): void {
    const current = this.metrics.get(metric) || 0;
    this.metrics.set(metric, current + value);
  }

  /**
   * Get current value of a metric
   */
  get(metric: string): number {
    return this.metrics.get(metric) || 0;
  }

  /**
   * Get all metrics
   */
  getAll(): OrchestrationMetrics {
    return {
      totalFlows: this.get("totalFlows"),
      totalLLMCalls: this.get("totalLLMCalls"),
      totalLLMTokens: this.get("totalLLMTokens"),
      totalFilesRead: this.get("totalFilesRead"),
      totalFieldsExtracted: this.get("totalFieldsExtracted"),
      totalArtifactsGenerated: this.get("totalArtifactsGenerated"),
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.metrics.set("totalFlows", 0);
    this.metrics.set("totalLLMCalls", 0);
    this.metrics.set("totalLLMTokens", 0);
    this.metrics.set("totalFilesRead", 0);
    this.metrics.set("totalFieldsExtracted", 0);
    this.metrics.set("totalArtifactsGenerated", 0);
  }
}

/**
 * ReportBuilder
 * Builds comprehensive orchestration reports
 */
export class ReportBuilder {
  /**
   * Build a complete orchestration report from step results
   */
  buildReport(
    stepResults: Map<string, StepResult>,
    totalExecutionTime: number,
    metrics: MetricsCollector,
    startTime: number,
  ): OrchestrationReport {
    // Build summary
    const summary = this.buildSummary(stepResults, totalExecutionTime);

    // Build step reports
    const stepReports: StepReport[] = [];
    const allFlowReports: FlowReport[] = [];
    const allErrors: ErrorReport[] = [];
    const allWarnings: WarningReport[] = [];
    const allValidations: ValidationResult[] = [];

    for (const [stepName, stepResult] of stepResults) {
      const stepReport = this.buildStepReport(stepResult);
      stepReports.push(stepReport);

      // Collect flow reports
      allFlowReports.push(...stepReport.flows);

      // Collect validations
      allValidations.push(...stepResult.validationResults);

      // Collect errors
      if (stepResult.error) {
        allErrors.push({
          stepName,
          error: stepResult.error,
          timestamp: stepResult.endTime,
        });
      }

      // Collect warnings from validations
      for (const validation of stepResult.validationResults) {
        if (!validation.passed && validation.warnings) {
          allWarnings.push({
            stepName,
            flowName: validation.flowName,
            validationType: validation.validationType,
            warning: validation.warnings.join("; "),
            timestamp: stepResult.endTime,
          });
        }
      }
    }

    // Aggregate validations
    const validationSummary = this.aggregateValidations(allValidations);

    return {
      summary,
      steps: stepReports,
      flows: allFlowReports,
      validations: validationSummary,
      metrics: metrics.getAll(),
      errors: allErrors,
      warnings: allWarnings,
      timestamp: startTime,
      version: "1.0.0",
    };
  }

  /**
   * Build summary from step results
   */
  private buildSummary(
    stepResults: Map<string, StepResult>,
    totalExecutionTime: number,
  ): OrchestrationSummary {
    const steps = Array.from(stepResults.values());
    const successfulSteps = steps.filter((s) => s.success).length;
    const failedSteps = steps.filter((s) => !s.success).length;

    return {
      success: failedSteps === 0,
      totalSteps: steps.length,
      successfulSteps,
      failedSteps,
      totalExecutionTime,
    };
  }

  /**
   * Build report for a single step
   */
  private buildStepReport(stepResult: StepResult): StepReport {
    const flowReports = this.buildFlowReports(stepResult.flowResults);
    const validationReport = this.buildValidationReport(
      stepResult.validationResults,
    );

    const successfulFlows = flowReports.filter((f) => f.success).length;
    const failedFlows = flowReports.filter((f) => !f.success).length;

    return {
      stepName: stepResult.stepName,
      success: stepResult.success,
      attempts: stepResult.attempts,
      startTime: stepResult.startTime,
      endTime: stepResult.endTime,
      executionTime: stepResult.endTime - stepResult.startTime,
      flowCount: flowReports.length,
      successfulFlows,
      failedFlows,
      flows: flowReports,
      validations: validationReport,
      error: stepResult.error,
    };
  }

  /**
   * Build flow reports from flow results
   */
  private buildFlowReports(
    flowResults: Map<string, FlowExecutionResult>,
  ): FlowReport[] {
    const reports: FlowReport[] = [];

    for (const [flowName, result] of flowResults) {
      reports.push({
        flowName,
        success: result.success,
        attempt: result.attempt,
        executionTime: result.metrics.executionTime,
        outputs: result.outputs,
        metrics: result.metrics,
        error: result.error,
      });
    }

    return reports;
  }

  /**
   * Build validation report from validation results
   */
  private buildValidationReport(
    validations: ValidationResult[],
  ): ValidationReport {
    const passed = validations.filter((v) => v.passed).length;
    const failed = validations.filter((v) => !v.passed).length;

    const byType: ValidationReport["byType"] = {};

    // Group by type
    const types: Array<ValidationResult["validationType"]> = [
      "fileExistence",
      "schemaCompliance",
      "contentQuality",
      "crossFlow",
    ];

    for (const type of types) {
      const typeValidations = validations.filter((v) => v.validationType === type);

      if (typeValidations.length > 0) {
        byType[type] = {
          total: typeValidations.length,
          passed: typeValidations.filter((v) => v.passed).length,
          failed: typeValidations.filter((v) => !v.passed).length,
        };
      }
    }

    return {
      total: validations.length,
      passed,
      failed,
      byType,
      details: validations,
    };
  }

  /**
   * Aggregate all validations across steps
   */
  private aggregateValidations(validations: ValidationResult[]): {
    total: number;
    passed: number;
    failed: number;
    byType: {
      fileExistence?: ValidationTypeReport;
      schemaCompliance?: ValidationTypeReport;
      contentQuality?: ValidationTypeReport;
      crossFlow?: ValidationTypeReport;
    };
  } {
    const passed = validations.filter((v) => v.passed).length;
    const failed = validations.filter((v) => !v.passed).length;

    const byType: {
      fileExistence?: ValidationTypeReport;
      schemaCompliance?: ValidationTypeReport;
      contentQuality?: ValidationTypeReport;
      crossFlow?: ValidationTypeReport;
    } = {};

    const types: Array<ValidationResult["validationType"]> = [
      "fileExistence",
      "schemaCompliance",
      "contentQuality",
      "crossFlow",
    ];

    for (const type of types) {
      const typeValidations = validations.filter((v) => v.validationType === type);

      if (typeValidations.length > 0) {
        byType[type] = {
          total: typeValidations.length,
          passed: typeValidations.filter((v) => v.passed).length,
          failed: typeValidations.filter((v) => !v.passed).length,
        };
      }
    }

    return {
      total: validations.length,
      passed,
      failed,
      byType,
    };
  }

  /**
   * Format report for console output (ASCII art)
   */
  formatConsole(report: OrchestrationReport): string {
    let output = "";

    // Header
    output += "█".repeat(80) + "\n";
    output += "🎯 MASTER ORCHESTRATOR - FINAL REPORT\n";
    output += "█".repeat(80) + "\n\n";

    // Summary
    output += "📊 SUMMARY\n";
    output += `  ${report.summary.success ? "✅" : "❌"} Status: ${report.summary.success ? "SUCCESS" : "FAILED"}\n`;
    output += `  ⏱️  Total time: ${(report.summary.totalExecutionTime / 1000).toFixed(2)}s\n`;
    output += `  📌 Steps: ${report.summary.successfulSteps}/${report.summary.totalSteps} successful\n\n`;

    // Steps
    for (const step of report.steps) {
      output += "═".repeat(80) + "\n";
      output += `📍 STEP: ${step.stepName}\n`;
      if (step.description) {
        output += `   ${step.description}\n`;
      }
      output += `  ⏱️  Time: ${(step.executionTime / 1000).toFixed(2)}s\n`;
      output += `  🔄 Attempts: ${step.attempts}\n`;
      output += `  ${step.success ? "✅" : "❌"} Status: ${step.success ? "SUCCESS" : "FAILED"}\n\n`;

      // Flows
      if (step.flows.length > 0) {
        output += `  Flows executed (${step.flows.length}):\n`;
        for (const flow of step.flows) {
          output += `    ${flow.success ? "✅" : "❌"} ${flow.flowName}\n`;
          if (flow.success) {
            output += `       • Time: ${(flow.executionTime / 1000).toFixed(2)}s\n`;
            output += `       • Fields extracted: ${flow.metrics.fieldsExtracted}\n`;
            output += `       • Artifacts: ${flow.metrics.artifactsGenerated}\n`;
            if (flow.outputs.intermediateJson) {
              output += `       • Output: ${flow.outputs.intermediateJson}\n`;
            }
          } else if (flow.error) {
            output += `       • Error: ${flow.error}\n`;
          }
        }
        output += "\n";
      }

      // Validations
      if (step.validations.total > 0) {
        output += `  Validations:\n`;
        for (const [type, typeReport] of Object.entries(step.validations.byType)) {
          const icon = typeReport.failed === 0 ? "✅" : "⚠️";
          output += `    ${icon} ${type}: ${typeReport.passed}/${typeReport.total} PASSED\n`;
        }
        output += "\n";
      }

      // Error
      if (step.error) {
        output += `  ❌ Error: ${step.error}\n\n`;
      }
    }

    // Metrics
    output += "═".repeat(80) + "\n";
    output += "📈 METRICS\n";
    output += `  • Total flows: ${report.metrics.totalFlows}\n`;
    output += `  • LLM calls: ${report.metrics.totalLLMCalls}\n`;
    output += `  • LLM tokens: ~${report.metrics.totalLLMTokens.toLocaleString()}\n`;
    output += `  • Files read: ${report.metrics.totalFilesRead}\n`;
    output += `  • Fields extracted: ${report.metrics.totalFieldsExtracted}\n`;
    output += `  • Artifacts generated: ${report.metrics.totalArtifactsGenerated}\n\n`;

    // Footer
    output += "█".repeat(80) + "\n";

    return output;
  }

  /**
   * Save report to JSON file
   */
  async saveToFile(report: OrchestrationReport, filePath: string): Promise<void> {
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, JSON.stringify(report, null, 2), "utf-8");
  }
}
