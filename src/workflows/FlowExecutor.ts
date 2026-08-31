import type { ChatLLM } from "../config/llm.js";
import type { ResolvedFlowDefinition } from "../types/index.js";
import { ReaderAgent } from "../agents/reader.js";
import { AnalyzerAgent } from "../agents/analyzer.js";
import { WriterAgent } from "../agents/writer.js";
import { ArtifactGeneratorAgent } from "../agents/artifactGenerator.js";
import { QuickContentValidator } from "../tools/validators/quickContentValidator.js";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../..");

export interface FlowResult {
  flowName: string;
  success: boolean;
  intermediateJsonPath?: string;
  artifacts?: Array<{
    fileName: string;
    filePath: string;
    size: number;
  }>;
  error?: string;
  stats?: {
    filesRead: number;
    fieldsExtracted: number;
    artifactsGenerated: number;
    executionTime: number;
  };
}

/**
 * FlowExecutor - Ejecuta el pipeline completo para un flujo individual
 * Pipeline: Reader → Analyzer → Writer → QuickValidator → ArtifactGenerator
 */
export class FlowExecutor {
  private readerAgent: ReaderAgent;
  private analyzerAgent: AnalyzerAgent;
  private writerAgent: WriterAgent;
  private artifactGeneratorAgent: ArtifactGeneratorAgent;
  private quickContentValidator: QuickContentValidator;

  constructor(llm: ChatLLM) {
    this.readerAgent = new ReaderAgent(llm);
    this.analyzerAgent = new AnalyzerAgent(llm);
    this.writerAgent = new WriterAgent();
    this.artifactGeneratorAgent = new ArtifactGeneratorAgent();
    this.quickContentValidator = new QuickContentValidator();
  }

  /**
   * Ejecuta el pipeline completo para un flujo
   */
  async execute(flowDefinition: ResolvedFlowDefinition): Promise<FlowResult> {
    const startTime = Date.now();

    console.log("\n" + "=".repeat(80));
    console.log(`🚀 EXECUTING FLOW: ${flowDefinition.name}`);
    console.log("=".repeat(80));
    console.log(`Description: ${flowDefinition.description || "N/A"}`);
    console.log(
      `Schema: ${flowDefinition.schema}`,
    );
    console.log(`Templates: ${flowDefinition.templates.join(", ")}`);
    console.log("=".repeat(80));

    try {
      // FASE 0: CARGAR DEPENDENCIAS (si existen)
      let dependencyData: Record<string, any> = {};

      if (flowDefinition.inputDependencies) {
        console.log("\n📦 PHASE 0: LOADING INPUT DEPENDENCIES");
        const depCount = Object.keys(flowDefinition.inputDependencies).length;
        console.log(`[Dependencies] Found ${depCount} input dependencies`);

        for (const [key, path] of Object.entries(
          flowDefinition.inputDependencies,
        )) {
          try {
            const resolvedPath = resolve(PROJECT_ROOT, path);
            console.log(`  • Loading ${key} from ${path}`);
            const content = await readFile(resolvedPath, "utf-8");
            dependencyData[key] = JSON.parse(content);
            console.log(`    ✓ Loaded ${key} successfully`);
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            throw new Error(
              `Failed to load input dependency "${key}" from ${path}: ${errorMsg}`,
            );
          }
        }

        console.log(`[Dependencies] All ${depCount} dependencies loaded successfully`);
      }

      // FASE 1: READER AGENT - Leer y consolidar datos
      console.log("\n📖 PHASE 1: DATA COLLECTION");
      const sourceData = await this.readerAgent.read({
        flowDefinition,
        dependencies: dependencyData,
      });

      // FASE 2: ANALYZER AGENT - Análisis inteligente con LLM
      console.log("\n🧠 PHASE 2: INTELLIGENT ANALYSIS");
      const analysisResult = await this.analyzerAgent.analyze({ sourceData, flowDefinition });

      // FASE 3: WRITER AGENT - Construir y escribir JSON intermedio
      console.log("\n📝 PHASE 3: OUTPUT GENERATION");
      const writeResult = await this.writerAgent.write({
        schema: sourceData.schema.data,
        extractedFields: analysisResult.extractedFields,
        flowDefinition,
      });

      if (!writeResult.success) {
        throw new Error(
          `Failed to write intermediate JSON: ${writeResult.validationErrors?.join(", ")}`,
        );
      }

      // FASE 3.5: QUICK VALIDATION - Comprobación rápida y determinista
      console.log("\n🕵️ PHASE 3.5: QUICK SANITY CHECK");
      const intermediateJsonForValidation = await readFile(writeResult.outputPath, "utf-8");
      const parsedForValidation = JSON.parse(intermediateJsonForValidation);
      const quickValidationResult = this.quickContentValidator.validate(parsedForValidation, flowDefinition.name);

      if (!quickValidationResult.isValid) {
        console.log(`[QuickValidator] Failed sanity checks:`);
        quickValidationResult.errors.forEach(err => console.error(`  - ${err}`));
        throw new Error(`Quick validation failed: ${quickValidationResult.errors.join("; ")}`);
      }
      console.log(`[QuickValidator] Passed all sanity checks.`);

      // FASE 4: ARTIFACT GENERATOR - Generar artefactos desde templates
      console.log("\n🔨 PHASE 4: ARTIFACT GENERATION");

      const generationResult = await this.artifactGeneratorAgent.generate({
        outputJson: parsedForValidation,
        flowDefinition,
      });

      // Calcular estadísticas
      const executionTime = Date.now() - startTime;
      const stats = {
        filesRead: sourceData.repoFiles.length +
                   (sourceData.build ? 1 : 0) +
                   (sourceData.release ? 1 : 0),
        fieldsExtracted: analysisResult.extractedFields.length,
        artifactsGenerated: generationResult.artifacts.length,
        executionTime,
      };

      // Resumen final
      console.log("\n" + "=".repeat(80));
      console.log(`✅ FLOW COMPLETED: ${flowDefinition.name}`);
      console.log("=".repeat(80));
      console.log(`⏱️  Execution time: ${(executionTime / 1000).toFixed(2)}s`);
      console.log(`📊 Statistics:`);
      console.log(`   - Files read: ${stats.filesRead}`);
      console.log(`   - Fields extracted: ${stats.fieldsExtracted}`);
      console.log(`   - Artifacts generated: ${stats.artifactsGenerated}`);
      console.log(`\n📄 Intermediate JSON: ${writeResult.outputPath}`);

      if (generationResult.artifacts.length > 0) {
        console.log(`\n🎨 Generated Artifacts:`);
        for (const artifact of generationResult.artifacts) {
          console.log(`   • ${artifact.fileName} (${artifact.size} bytes)`);
        }
      }
      console.log("=".repeat(80));

      return {
        flowName: flowDefinition.name,
        success: generationResult.success,
        intermediateJsonPath: writeResult.outputPath,
        artifacts: generationResult.artifacts.map((a) => ({
          fileName: a.fileName,
          filePath: a.filePath,
          size: a.size,
        })),
        stats,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error("\n" + "=".repeat(80));
      console.error(`❌ FLOW FAILED: ${flowDefinition.name}`);
      console.error("=".repeat(80));
      console.error(`Error: ${errorMessage}`);
      console.error(`⏱️  Execution time: ${(executionTime / 1000).toFixed(2)}s`);
      console.error("=".repeat(80));

      return {
        flowName: flowDefinition.name,
        success: false,
        error: errorMessage,
        stats: {
          filesRead: 0,
          fieldsExtracted: 0,
          artifactsGenerated: 0,
          executionTime,
        },
      };
    }
  }
}
