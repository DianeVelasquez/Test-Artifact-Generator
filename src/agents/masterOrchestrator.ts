import type { ChatLLM } from "../config/llm.js";
import { FlowOrchestrator, type OrchestrationResult } from "../workflows/FlowOrchestrator.js";
import { FlowConfigLoader } from "../engines/FlowConfigLoader.js";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  OrchestrationStep,
  ValidationRules,
  MasterOrchestratorConfig,
  ExecutionContext,
  StepResult,
  FlowExecutionResult,
  ValidationResult,
  OnSuccessAction,
} from "../types/OrchestrationTypes.js";
import type { OrchestrationReport } from "../types/ReportTypes.js";

// Validators
import { FileExistenceValidator } from "../tools/validators/fileExistenceValidator.js";
import { SchemaValidator } from "../tools/validators/schemaValidator.js";
import { ContentValidator } from "../tools/validators/contentValidator.js";
import { CrossFlowValidator } from "../tools/validators/crossFlowValidator.js";

// Reporting
import { ReportBuilder, MetricsCollector } from "../tools/reportBuilder.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../..");

/**
 * Master Orchestrator Agent - The brain of the system
 *
 * Hybrid approach:
 * - Deterministic: Flow control, retry logic, file/schema validation
 * - Intelligent: LLM-based content quality and cross-flow validation
 */
export class MasterOrchestratorAgent {
  private llm: ChatLLM;
  private flowOrchestrator: FlowOrchestrator;
  private configPath?: string;
  private enableIntelligentValidation: boolean;

  // Validators
  private fileValidator: FileExistenceValidator;
  private schemaValidator: SchemaValidator;
  private contentValidator: ContentValidator;
  private crossFlowValidator: CrossFlowValidator;

  // Reporting
  private reportBuilder: ReportBuilder;

  // Execution context
  private context: ExecutionContext;

  constructor(llm: ChatLLM, config?: MasterOrchestratorConfig) {
    this.llm = llm;
    this.configPath = config?.configPath;
    this.enableIntelligentValidation = config?.enableIntelligentValidation ?? true;

    // Initialize FlowOrchestrator (will be called for each step)
    this.flowOrchestrator = new FlowOrchestrator(this.llm, config?.configPath);

    // Initialize validators
    this.fileValidator = new FileExistenceValidator();
    this.schemaValidator = new SchemaValidator();
    this.contentValidator = new ContentValidator(this.llm);
    this.crossFlowValidator = new CrossFlowValidator(this.llm);

    // Initialize reporting
    this.reportBuilder = new ReportBuilder();

    // Initialize execution context
    this.context = {
      variables: new Map(),
      stepResults: new Map(),
      startTime: Date.now(),
    };
  }

  /**
   * Main entry point: Execute all orchestration steps
   */
  async execute(): Promise<OrchestrationReport> {
    console.log("\n" + "█".repeat(80));
    console.log("🧠 MASTER ORCHESTRATOR AGENT - INTELLIGENT EXECUTION");
    console.log("█".repeat(80));

    const metricsCollector = new MetricsCollector();

    try {
      // Load configuration with orchestration steps
      const config = await this.loadConfiguration();

      // Fallback if no orchestration steps defined
      if (!config.orchestrationSteps || config.orchestrationSteps.length === 0) {
        console.log("\n⚠️  No orchestration steps defined. Using standard FlowOrchestrator.");
        const result = await this.flowOrchestrator.executeAllFlows();
        return this.buildReportFromStandardExecution(result, metricsCollector);
      }

      console.log(`\n📋 Loaded ${config.orchestrationSteps.length} orchestration steps`);

      // Execute each orchestration step sequentially
      for (const step of config.orchestrationSteps) {
        console.log(`\n${"═".repeat(80)}`);
        console.log(`📌 ORCHESTRATION STEP: ${step.name}`);
        if (step.description) {
          console.log(`   ${step.description}`);
        }
        console.log(`${"═".repeat(80)}`);

        const stepResult = await this.executeStep(step, config.validation, metricsCollector);
        this.context.stepResults.set(step.name, stepResult);

        if (!stepResult.success) {
          console.error(`\n❌ Step "${step.name}" failed after ${stepResult.attempts} attempts`);
          console.error(`   Error: ${stepResult.error}`);

          // Critical failure - stop execution
          break;
        }

        console.log(`\n✅ Step "${step.name}" completed successfully`);
      }

      // Generate comprehensive final report
      const report = this.generateReport(metricsCollector);

      // Output report to console and file
      await this.outputReport(report);

      return report;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Master Orchestrator fatal error: ${errorMsg}`);

      if (error instanceof Error && error.stack) {
        console.error("Stack trace:", error.stack);
      }

      // Generate error report
      return this.generateErrorReport(error, this.context.startTime, metricsCollector);
    }
  }

  /**
   * Execute a single orchestration step with retry logic
   */
  private async executeStep(
    step: OrchestrationStep,
    validationRules?: ValidationRules,
    metricsCollector?: MetricsCollector,
  ): Promise<StepResult> {
    const startTime = Date.now();
    const maxAttempts = step.retryPolicy?.maxAttempts || 1;
    let attempt = 0;
    let lastError: string | undefined;

    const flowResults = new Map<string, FlowExecutionResult>();
    const validationResults: ValidationResult[] = [];

    // Resolve dynamic scope (e.g., forEach operations)
    const executionSets = this.resolveDynamicScope(step);

    console.log(`\n   Flows to execute: ${step.flows.join(", ")}`);
    console.log(`   Execution mode: ${step.executionMode}`);
    if (step.dynamicScope) {
      console.log(`   Dynamic scope: ${executionSets.length} iterations`);
    }

    // Retry loop
    while (attempt < maxAttempts) {
      attempt++;

      if (attempt > 1) {
        console.log(`\n   🔄 Retry attempt ${attempt}/${maxAttempts}`);
      }

      try {
        // Clear previous results on retry
        if (attempt > 1) {
          flowResults.clear();
          validationResults.length = 0;
        }

        // Execute flows for this step
        for (const execSet of executionSets) {
          const results = await this.executeFlowSet(
            execSet.flows,
            execSet.context,
            step.executionMode,
            metricsCollector,
          );

          // Store results
          for (const [flowName, result] of results.entries()) {
            const key = execSet.context?.operationName
              ? `${flowName}-${execSet.context.operationName}`
              : flowName;
            flowResults.set(key, result);
          }

          // Check if any flow failed
          const hasFailure = Array.from(results.values()).some((r) => !r.success);
          if (hasFailure && step.retryPolicy?.enabled) {
            throw new Error(`Flow execution failed in attempt ${attempt}`);
          }
        }

        // Validate outputs
        if (step.validation) {
          console.log(`\n   🔍 Running validations...`);

          // Create a comprehensive map of ALL flow results so far for the validator
          const allFlowResults = new Map<string, FlowExecutionResult>();

          // 1. Add results from all previous steps stored in the context
          for (const stepResult of this.context.stepResults.values()) {
            if (stepResult.flowResults) {
              for (const [key, flowRes] of stepResult.flowResults.entries()) {
                allFlowResults.set(key, flowRes);
              }
            }
          }

          // 2. Add results from the current step (which are not in the context yet)
          for (const [key, flowRes] of flowResults.entries()) {
            allFlowResults.set(key, flowRes);
          }
          
          // 3. Pass the complete map to the validator
          const validations = await this.validateStepOutputs(
            step,
            allFlowResults,
            validationRules,
          );
          validationResults.push(...validations);

          const hasValidationFailure = validations.some((v) => !v.passed);
          if (hasValidationFailure && step.retryPolicy?.enabled) {
            throw new Error(`Validation failed in attempt ${attempt}`);
          }
        }

        // Execute onSuccess actions
        if (step.onSuccess) {
          await this.executeOnSuccessActions(step.onSuccess, flowResults);
        }

        // Success! Break retry loop
        return {
          stepName: step.name,
          success: true,
          flowResults,
          validationResults,
          attempts: attempt,
          startTime,
          endTime: Date.now(),
        };

      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.warn(`   ⚠️  Attempt ${attempt} failed: ${lastError}`);

        // Wait before retry (exponential backoff)
        if (attempt < maxAttempts && step.retryPolicy?.enabled) {
          const backoff = (step.retryPolicy.backoffMs || 1000) * attempt;
          console.log(`   ⏳ Waiting ${backoff}ms before retry...`);
          await this.sleep(backoff);
        }
      }
    }

    // All attempts exhausted - failure
    return {
      stepName: step.name,
      success: false,
      flowResults,
      validationResults,
      attempts: attempt,
      error: lastError || "Unknown error after all retry attempts",
      startTime,
      endTime: Date.now(),
    };
  }

  /**
   * Execute a set of flows (sequential or parallel)
   */
  private async executeFlowSet(
    flowNames: string[],
    context: any,
    mode: "sequential" | "parallel",
    metricsCollector?: MetricsCollector,
  ): Promise<Map<string, FlowExecutionResult>> {
    const results = new Map<string, FlowExecutionResult>();

    if (mode === "parallel") {
      console.log(`   ⚡ Executing ${flowNames.length} flows in parallel...`);

      // Execute flows in parallel using Promise.all
      const promises = flowNames.map((flowName) =>
        this.executeFlowWithContext(flowName, context, metricsCollector),
      );
      const parallelResults = await Promise.all(promises);

      parallelResults.forEach((result, index) => {
        results.set(flowNames[index], result);
      });

    } else {
      console.log(`   📝 Executing ${flowNames.length} flows sequentially...`);

      // Execute flows sequentially (one after another)
      for (const flowName of flowNames) {
        const result = await this.executeFlowWithContext(flowName, context, metricsCollector);
        results.set(flowName, result);

        // Stop on first failure in sequential mode
        if (!result.success) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Execute a single flow using existing FlowOrchestrator
   */
  private async executeFlowWithContext(
    flowName: string,
    context?: any,
    metricsCollector?: MetricsCollector,
  ): Promise<FlowExecutionResult> {
    const startTime = Date.now();

    try {
      // Call existing FlowOrchestrator.executeFlow() and pass context
      const result = await this.flowOrchestrator.executeFlow(flowName, context);

      // Track metrics
      if (metricsCollector) {
        metricsCollector.increment("totalFlows", 1);
        if (result.stats) {
          metricsCollector.increment("totalFilesRead", result.stats.filesRead);
          metricsCollector.increment("totalFieldsExtracted", result.stats.fieldsExtracted);
          metricsCollector.increment("totalArtifactsGenerated", result.stats.artifactsGenerated);
          // Estimate LLM usage
          metricsCollector.increment("totalLLMCalls", 1);
          metricsCollector.increment("totalLLMTokens", result.stats.fieldsExtracted * 100);
        }
      }

      return {
        flowName: result.flowName, // Use name from result, which might be contextualized
        success: result.success,
        attempt: 1,
        outputs: {
          intermediateJson: result.intermediateJsonPath,
          artifacts: result.artifacts?.map((a) => a.filePath),
        },
        error: result.error,
        metrics: {
          executionTime: result.stats?.executionTime || (Date.now() - startTime),
          filesRead: result.stats?.filesRead || 0,
          fieldsExtracted: result.stats?.fieldsExtracted || 0,
          artifactsGenerated: result.stats?.artifactsGenerated || 0,
        },
      };

    } catch (error) {
      return {
        flowName,
        success: false,
        attempt: 1,
        outputs: {},
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          executionTime: Date.now() - startTime,
          filesRead: 0,
          fieldsExtracted: 0,
          artifactsGenerated: 0,
        },
      };
    }
  }

  /**
   * Resolve dynamic scope (forEach loops)
   */
  private resolveDynamicScope(step: OrchestrationStep): Array<{
    flows: string[];
    context?: any;
  }> {
    if (!step.dynamicScope) {
      // No dynamic scope - execute flows once
      return [{ flows: step.flows }];
    }

    // Get the array to iterate over from context variables
    const arrayVar = this.context.variables.get(step.dynamicScope.forEach);

    if (!Array.isArray(arrayVar)) {
      throw new Error(
        `Dynamic scope variable "${step.dynamicScope.forEach}" is not an array or not found. ` +
        `Available variables: ${Array.from(this.context.variables.keys()).join(", ")}`,
      );
    }

    console.log(`   📋 Dynamic scope: iterating over ${arrayVar.length} items`);

    // Create execution set for each item
    return arrayVar.map((item) => ({
      flows: step.flows,
      context: {
        [step.dynamicScope!.variable]: item,
      },
    }));
  }

  /**
   * Validate step outputs using configured validators
   */
  private async validateStepOutputs(
    step: OrchestrationStep,
    flowResults: Map<string, FlowExecutionResult>,
    validationRules?: ValidationRules,
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const config = step.validation!;

    // 1. File Existence Validation (deterministic)
    if (config.fileExistence) {
      console.log(`      • File existence checks...`);
      const fileValidations = await this.fileValidator.validate(flowResults);
      results.push(...fileValidations);
      const passed = fileValidations.filter((v) => v.passed).length;
      console.log(`        ✓ ${passed}/${fileValidations.length} files exist`);
    }

    // 2. Schema Compliance Validation (deterministic)
    if (config.schemaCompliance) {
      console.log(`      • Schema compliance checks...`);
      const schemaValidations = await this.schemaValidator.validate(flowResults);
      results.push(...schemaValidations);
      const passed = schemaValidations.filter((v) => v.passed).length;
      console.log(`        ✓ ${passed}/${schemaValidations.length} schemas valid`);
    }

    // 3. Content Quality Validation (LLM-based - intelligent)
    if (config.contentQuality && this.enableIntelligentValidation) {
      console.log(`      • Content quality checks (LLM)...`);
      const contentValidations = await this.contentValidator.validate(flowResults);
      results.push(...contentValidations);
      const passed = contentValidations.filter((v) => v.passed).length;
      console.log(`        ✓ ${passed}/${contentValidations.length} content checks passed`);

      // Log details for failed content validations
      for (const validation of contentValidations) {
        if (!validation.passed) {
          console.warn(`        ⚠️ [${validation.flowName}] Content quality validation failed!`);
          console.warn(`           Reason: ${validation.details}`);
          if (validation.warnings && validation.warnings.length > 0) {
            console.warn(`           Issues:`);
            validation.warnings.forEach(issue => console.warn(`             - ${issue}`));
          }
        }
      }
    }

    // 4. Cross-Flow Validation (LLM-based - intelligent)
    if (config.crossFlowValidation && this.enableIntelligentValidation && validationRules?.crossFlowRules) {
      console.log(`      • Cross-flow validation checks (LLM)...`);
      const crossValidations = await this.crossFlowValidator.validate(
        flowResults,
        validationRules.crossFlowRules,
      );
      results.push(...crossValidations);
      const passed = crossValidations.filter((v) => v.passed).length;
      console.log(`        ✓ ${passed}/${crossValidations.length} cross-flow checks passed`);
    }

    return results;
  }

  /**
   * Execute onSuccess actions
   */
  private async executeOnSuccessActions(
    onSuccess: OnSuccessAction,
    _flowResults: Map<string, FlowExecutionResult>,
  ): Promise<void> {
    if (onSuccess.extractOperations) {
      const { sourceFile, field, storeAs } = onSuccess.extractOperations;

      console.log(`\n   📤 Extracting operations from ${sourceFile}`);

      try {
        const sourcePath = resolve(PROJECT_ROOT, sourceFile);
        const content = await readFile(sourcePath, "utf-8");
        const data = JSON.parse(content);

        const operations = data[field];

        if (!Array.isArray(operations)) {
          throw new Error(`Field "${field}" is not an array in ${sourceFile}`);
        }

        // Store in context variables
        this.context.variables.set(storeAs, operations);
        console.log(`   ✓ Stored ${operations.length} operations as "${storeAs}"`);
        console.log(`     Operations: ${operations.join(", ")}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to extract operations: ${errorMsg}`);
      }
    }
  }

  /**
   * Load configuration with orchestration steps
   */
  private async loadConfiguration(): Promise<any> {
    const loader = new FlowConfigLoader(this.configPath);
    await loader.load();
    return loader.getConfig();
  }

  /**
   * Generate comprehensive final report
   */
  private generateReport(metricsCollector: MetricsCollector): OrchestrationReport {
    const totalExecutionTime = Date.now() - this.context.startTime;

    return this.reportBuilder.buildReport(
      this.context.stepResults,
      totalExecutionTime,
      metricsCollector,
      this.context.startTime,
    );
  }

  /**
   * Generate error report
   */
  private generateErrorReport(
    _error: unknown,
    startTime: number,
    metricsCollector: MetricsCollector,
  ): OrchestrationReport {
    return this.reportBuilder.buildReport(
      this.context.stepResults,
      Date.now() - startTime,
      metricsCollector,
      startTime,
    );
  }

  /**
   * Build report from standard FlowOrchestrator execution (fallback)
   */
  private buildReportFromStandardExecution(
    result: OrchestrationResult,
    metricsCollector: MetricsCollector,
  ): OrchestrationReport {
    // Convert standard execution to report format
    // This is a simplified conversion for backward compatibility
    return {
      summary: {
        success: result.success,
        totalSteps: 1,
        successfulSteps: result.success ? 1 : 0,
        failedSteps: result.success ? 0 : 1,
        totalExecutionTime: result.totalExecutionTime,
      },
      steps: [],
      flows: [],
      validations: {
        total: 0,
        passed: 0,
        failed: 0,
        byType: {},
      },
      metrics: metricsCollector.getAll(),
      errors: [],
      warnings: [],
      timestamp: this.context.startTime,
      version: "1.0.0",
    };
  }

  /**
   * Output report to console and file
   */
  private async outputReport(report: OrchestrationReport): Promise<void> {
    // Console output
    const consoleOutput = this.reportBuilder.formatConsole(report);
    console.log("\n" + consoleOutput);

    // File output
    const reportPath = resolve(PROJECT_ROOT, "output", "orchestration-report.json");
    await this.reportBuilder.saveToFile(report, reportPath);
    console.log(`\n📄 Report saved to: ${reportPath}`);
  }

  /**
   * Helper: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
