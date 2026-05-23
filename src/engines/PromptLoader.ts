import { readFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PromptConfigFileSchema,
  type PromptConfigFile,
  type PromptConfig,
  type PromptSection,
} from "../types/PromptTypes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../..");

/**
 * Carga y ensambla prompts desde archivos de configuración externos
 */
export class PromptLoader {
  private configPath: string;
  private promptsDir: string;
  private config: PromptConfigFile | null = null;

  constructor(configPath?: string) {
    this.configPath =
      configPath || join(PROJECT_ROOT, "specs/prompts/prompt-config.json");
    this.promptsDir = join(PROJECT_ROOT, "specs/prompts");
  }

  /**
   * Carga la configuración de prompts
   */
  async load(): Promise<PromptConfigFile> {
    try {
      const content = await readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(content);

      // Validar con Zod
      const validated = PromptConfigFileSchema.parse(parsed);

      this.config = validated;
      return validated;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to load prompt configuration from ${this.configPath}: ${error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Carga y ensambla un prompt específico con variables
   * @param promptName - Nombre del prompt (e.g., "fieldExtraction")
   * @param variables - Variables para reemplazar en templates (e.g., {schema: "...", sources: "..."})
   */
  async loadPrompt(
    promptName: string,
    variables: Record<string, any> = {},
  ): Promise<string> {
    // Cargar config si no está cargada
    if (!this.config) {
      await this.load();
    }

    if (!this.config) {
      throw new Error("Prompt configuration not loaded");
    }

    // Obtener configuración del prompt
    const promptConfig = this.config.prompts[promptName];
    if (!promptConfig) {
      throw new Error(
        `Prompt "${promptName}" not found in configuration. Available prompts: ${Object.keys(this.config.prompts).join(", ")}`,
      );
    }

    // Ensamblar prompt desde secciones
    const assembledPrompt = await this.assemblePrompt(
      promptConfig,
      variables,
    );

    return assembledPrompt;
  }

  /**
   * Ensambla un prompt desde sus secciones
   */
  private async assemblePrompt(
    config: PromptConfig,
    variables: Record<string, any>,
  ): Promise<string> {
    const sections: string[] = [];

    for (const section of config.sections) {
      try {
        const sectionContent = await this.loadSection(section, variables);
        if (sectionContent) {
          sections.push(sectionContent);
        }
      } catch (error) {
        if (section.required) {
          throw new Error(
            `Failed to load required section "${section.name}": ${error instanceof Error ? error.message : String(error)}`,
          );
        } else {
          console.warn(
            `Failed to load optional section "${section.name}", skipping...`,
          );
        }
      }
    }

    return sections.join("\n");
  }

  /**
   * Carga el contenido de una sección
   */
  private async loadSection(
    section: PromptSection,
    variables: Record<string, any>,
  ): Promise<string> {
    let content: string;

    if (section.file) {
      // Cargar desde archivo
      const filePath = join(this.promptsDir, section.file);
      content = await readFile(filePath, "utf-8");
    } else if (section.template) {
      // Usar template inline
      content = section.template;
    } else {
      throw new Error(
        `Section "${section.name}" must have either "file" or "template" property`,
      );
    }

    // Reemplazar variables en el contenido
    return this.replaceVariables(content, variables);
  }

  /**
   * Reemplaza variables en formato {{variable}} con sus valores
   */
  private replaceVariables(
    template: string,
    variables: Record<string, any>,
  ): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const stringValue =
        typeof value === "string" ? value : JSON.stringify(value, null, 2);
      result = result.replace(new RegExp(placeholder, "g"), stringValue);
    }

    return result;
  }

  /**
   * Obtiene la configuración de un prompt específico
   */
  getPromptConfig(promptName: string): PromptConfig | undefined {
    if (!this.config) {
      throw new Error("Configuration not loaded. Call load() first.");
    }
    return this.config.prompts[promptName];
  }

  /**
   * Lista todos los prompts disponibles
   */
  getAvailablePrompts(): string[] {
    if (!this.config) {
      throw new Error("Configuration not loaded. Call load() first.");
    }
    return Object.keys(this.config.prompts);
  }
}

/**
 * Helper function para cargar un prompt
 */
export async function loadPrompt(
  promptName: string,
  variables: Record<string, any> = {},
  configPath?: string,
): Promise<string> {
  const loader = new PromptLoader(configPath);
  return loader.loadPrompt(promptName, variables);
}
