import { TemplateRendererTool } from "../tools/templateRenderer.js";
import { FieldMapperTool } from "../tools/fieldMapper.js";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  LoadedTemplate,
  GeneratedArtifact,
  GenerationResult,
  ResolvedFlowDefinition,
} from "../types/index.js";
import { TemplateLoader } from "../engines/TemplateLoader.js";

export interface ArtifactGeneratorAgentInput {
  outputJson: any;
  flowDefinition: ResolvedFlowDefinition;
}

/**
 * ArtifactGeneratorAgent - Genera múltiples artefactos desde templates
 * Recibe un array de templates y genera un artefacto por cada uno
 */
export class ArtifactGeneratorAgent {
  private templateRenderer: TemplateRendererTool;
  private fieldMapper: FieldMapperTool;
  private templateLoader: TemplateLoader;

  constructor() {
    this.templateRenderer = new TemplateRendererTool();
    this.fieldMapper = new FieldMapperTool();
    this.templateLoader = new TemplateLoader();
  }

  async generate(
    input: ArtifactGeneratorAgentInput,
  ): Promise<GenerationResult> {
    return this.generateSingleArtifacts(input);
  }

  /**
   * Generates artifacts normally (single set of templates)
   */
  private async generateSingleArtifacts(
    input: ArtifactGeneratorAgentInput,
  ): Promise<GenerationResult> {
    const { outputJson, flowDefinition } = input;
    const outputDir = flowDefinition.resolvedOutputPaths.artifacts;

    console.log("\n[ArtifactGeneratorAgent] Starting artifact generation...");
    console.log(`[Flow] ${flowDefinition.name}`);
    console.log(
      `[Templates] ${flowDefinition.templates.length} templates to process`,
    );
    console.log(`[OutputDir] ${outputDir}`);

    const artifacts: GeneratedArtifact[] = [];
    const errors: string[] = [];

    // Crear directorio de salida si no existe
    await mkdir(outputDir, { recursive: true });

    // Cargar todos los templates
    console.log("\n[Loading] Templates...");
    let loadedTemplates: LoadedTemplate[];
    try {
      loadedTemplates = await this.templateLoader.loadTemplates(
        flowDefinition.templates,
      );
      console.log(`[OK] Loaded ${loadedTemplates.length} templates`);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      errors.push(`Failed to load templates: ${errorMsg}`);
      return {
        success: false,
        artifacts: [],
        errors,
      };
    }

    // Procesar cada template
    for (const template of loadedTemplates) {
      if (template.config.enabled === false) {
        console.log(`\n[Skipping] ${template.name} (disabled)`);
        continue;
      }

      console.log(`\n[Processing] ${template.name}`);
      console.log(`  Description: ${template.config.description || "N/A"}`);

      try {
        // 1. Mapear campos de output.json a variables del template
        console.log(`  [Mapping] Extracting fields...`);
        const mapResult = await this.fieldMapper.run({
          outputJson,
          mapping: template.config.mapping,
        });

        if (!mapResult.success) {
          const error = `Mapping failed for ${template.name}: ${mapResult.errors?.join(", ")}`;
          console.error(`  [Error] ${error}`);
          errors.push(error);
          continue;
        }

        console.log(
          `  [Mapped] ${Object.keys(mapResult.mappedData!).length} fields`,
        );

        // 2. Pre-process data for specific templates if needed
        let finalMappedData = { ...mapResult.mappedData! };
        if (template.name === "RutaCritica") {
          console.log(`  [Pre-processing] Combining scenario lists for RutaCritica`);
          const allScenarios = [
            ...(finalMappedData.scenariosBddModular || []),
            ...(finalMappedData.scenariosBddIntegration || [])
          ];
          finalMappedData.allScenarios = allScenarios;
        }

        // 3. Renderizar el template usando el contenido cargado
        console.log(`  [Rendering] Applying template...`);
        const renderResult = await this.templateRenderer.run({
          templateContent: template.templateContent,
          data: finalMappedData,
          useContent: true,
        });

        if (!renderResult.success) {
          const error = `Rendering failed for ${template.name}: ${renderResult.error}`;
          console.error(`  [Error] ${error}`);
          errors.push(error);
          continue;
        }

        // 4. Post-procesar el artefacto si es necesario (ej. para JSON)
        console.log(`  [Post-processing] Cleaning and formatting...`);
        const finalContent = this.postProcessArtifact(
          renderResult.rendered!,
          template.name,
        );

        // 5. Determinar nombre de archivo (soportar variables)
        const fileName = this.resolveFileName(
          template.config.outputFileName,
          finalMappedData,
        );

        // 6. Escribir el archivo generado
        const outputPath = join(outputDir, fileName);
        await writeFile(outputPath, finalContent, "utf-8");

        console.log(`  [✓] Generated: ${outputPath}`);

        // Crear artefacto
        const artifact: GeneratedArtifact = {
          templateName: template.name,
          fileName,
          filePath: outputPath,
          content: finalContent,
          size: Buffer.byteLength(finalContent, "utf-8"),
        };

        artifacts.push(artifact);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : String(error);
        console.error(`  [Error] ${errorMsg}`);
        errors.push(`${template.name}: ${errorMsg}`);
      }
    }

    // Resumen
    const successCount = artifacts.length;
    const totalCount = loadedTemplates.filter(
      (t) => t.config.enabled !== false,
    ).length;
    console.log(
      `\n[Summary] ${successCount}/${totalCount} artifacts generated successfully`,
    );

    if (artifacts.length > 0) {
      console.log("\nGenerated artifacts:");
      for (const artifact of artifacts) {
        console.log(
          `  • ${artifact.fileName} (${artifact.size} bytes) - ${artifact.templateName}`,
        );
      }
    }

    return {
      success: errors.length === 0,
      artifacts,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Limpia y formatea el contenido de un artefacto generado.
   * Por ahora, solo maneja el caso especial de 'RutaCritica' para asegurar un JSON válido.
   */
  private postProcessArtifact(content: string, templateName: string): string {
    if (templateName !== "RutaCritica") {
      return content;
    }

    console.log(`    [JSON Cleanup] Applying specific rules for ${templateName}`);
    try {
      // Estrategia: Dividir el string por comillas para aislar los literales de texto.
      // Los elementos en índices impares del array 'parts' están DENTRO de las comillas.
      const parts = content.split('"');

      for (let i = 1; i < parts.length; i += 2) {
        // Escapar caracteres de control solo dentro de los literales de texto.
        parts[i] = parts[i]
          .replace(/\\/g, "\\\\") // Primero, escapar las propias barras invertidas.
          .replace(/\n/g, "\\n")  // Escapar saltos de línea.
          .replace(/\r/g, "\\r")  // Escapar retornos de carro.
          .replace(/\t/g, "\\t"); // Escapar tabulaciones.
      }

      // Volver a unir el string. Ahora los saltos de línea dentro de los textos están escapados.
      let processedContent = parts.join('"');

      // Ahora que el contenido está limpio, podemos usar regex de forma segura para quitar la coma final.
      // Busca una coma (,) seguida de cero o más espacios/saltos de línea escapados (\\s*) antes de un corchete de cierre (]).
      processedContent = processedContent.replace(/,\s*\]/g, "]");

      // Ahora que el JSON es válido, lo parseamos y lo re-escribimos con formato.
      const jsonObject = JSON.parse(processedContent);
      return JSON.stringify(jsonObject, null, 2);
    } catch (error) {
      console.error(
        `    [Error] Failed to clean up JSON for ${templateName}. Returning raw content.`,
        error,
      );
      // Si falla, devolvemos el contenido original para poder inspeccionarlo.
      return content;
    }
  }

  /**
   * Resuelve el nombre de archivo reemplazando variables
   * Ejemplo: "soap-request-{serviceName}.xml" → "soap-request-MyService.xml"
   */
  private resolveFileName(
    pattern: string,
    data: Record<string, any>,
  ): string {
    let resolved = pattern;

    // Buscar variables en el formato {variableName}
    const variableRegex = /\{(\w+)\}/g;
    const matches = pattern.matchAll(variableRegex);

    for (const match of matches) {
      const variableName = match[1];
      const value = data[variableName];

      if (value !== undefined && value !== null) {
        resolved = resolved.replace(`{${variableName}}`, String(value));
      }
    }

    return resolved;
  }
}
