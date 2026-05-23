import "dotenv/config";
import { createLLM } from "./config/llm.js";
import { MasterOrchestratorAgent } from "./agents/masterOrchestrator.js";
import { FLOW_CONFIG_PATH } from "./config/paths.js";

/**
 * Entry point principal del sistema multi-agente
 */
async function main() {
  console.log("Test-Artifact-Generator - QA Artifact Orchestrator\n");

  try {
    console.log("🤖 Initializing LLM provider...");
    const llm = createLLM();
    console.log(
      `✓ LLM initialized: ${llm.provider} / ${llm.model}\n`,
    );

    // Usar siempre el Master Orchestrator
    console.log("🧠 Using Master Orchestrator Agent...\n");

    const masterOrchestrator = new MasterOrchestratorAgent(llm, {
      configPath: FLOW_CONFIG_PATH,
      enableIntelligentValidation: true,
    });

    const report = await masterOrchestrator.execute();

    if (!report.summary.success) {
      console.error(
        `\n⚠️  Master Orchestrator finished with ${report.summary.failedSteps} of ${report.summary.totalSteps} steps failed`,
      );
      process.exit(1);
    }

    console.log(
      `\n✅ All ${report.summary.successfulSteps} steps completed successfully`,
    );

    console.log("\n✨ Done!\n");
  } catch (error) {
    console.error("\n❌ Fatal error:");
    console.error(error instanceof Error ? error.message : String(error));

    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Ejecutar
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
