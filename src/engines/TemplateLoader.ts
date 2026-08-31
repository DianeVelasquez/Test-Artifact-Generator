import { readFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TemplateConfigSchema,
  type TemplateConfig,
  type LoadedTemplate,
} from "../types/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../..");

/**
 * Carga templates desde specs/templates/{name}/
 */
export class TemplateLoader {
  private templatesDir: string;

  constructor(templatesDir?: string) {
    this.templatesDir = templatesDir || join(PROJECT_ROOT, "specs/templates");
  }

  /**
   * Carga un template por nombre
   * @param templateName - Nombre del template (ej: "SoapRequest")
   */
  async loadTemplate(templateName: string): Promise<LoadedTemplate> {
    try {
      const templateDir = join(this.templatesDir, templateName);
      const configPath = join(templateDir, "config.json");
      const templatePath = join(templateDir, "template.bbt");

      // Cargar config.json
      const configContent = await readFile(configPath, "utf-8");
      const parsedConfig = JSON.parse(configContent);

      // Validar con Zod
      const config = TemplateConfigSchema.parse(parsedConfig);

      // Cargar template.bbt
      const templateContent = await readFile(templatePath, "utf-8");

      return {
        name: templateName,
        config,
        templateContent,
        templatePath,
        configPath,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to load template "${templateName}": ${error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Carga múltiples templates
   */
  async loadTemplates(templateNames: string[]): Promise<LoadedTemplate[]> {
    const templates: LoadedTemplate[] = [];

    for (const name of templateNames) {
      const template = await this.loadTemplate(name);
      if (template.config.enabled !== false) {
        templates.push(template);
      }
    }

    return templates;
  }

  /**
   * Valida la configuración de mapping de un template
   */
  validateMapping(config: TemplateConfig): boolean {
    const { mapping } = config;

    // Verificar que haya al menos un campo mapeado
    if (!mapping || Object.keys(mapping).length === 0) {
      throw new Error(`Template "${config.name}" has no field mappings`);
    }

    // Validar cada mapping
    for (const [fieldName, mappingValue] of Object.entries(mapping)) {
      if (typeof mappingValue === "string") {
        // Mapping simple: validar que sea un path válido
        if (!mappingValue || mappingValue.trim() === "") {
          throw new Error(
            `Invalid mapping for field "${fieldName}": path cannot be empty`,
          );
        }
      } else {
        // Mapping complejo: validar que tenga path
        if (!mappingValue.path || mappingValue.path.trim() === "") {
          throw new Error(
            `Invalid mapping for field "${fieldName}": path is required`,
          );
        }
      }
    }

    return true;
  }
}

/**
 * Helper function para cargar un template
 */
export async function loadTemplate(
  templateName: string,
): Promise<LoadedTemplate> {
  const loader = new TemplateLoader();
  return loader.loadTemplate(templateName);
}

/**
 * Helper function para cargar múltiples templates
 */
export async function loadTemplates(
  templateNames: string[],
): Promise<LoadedTemplate[]> {
  const loader = new TemplateLoader();
  return loader.loadTemplates(templateNames);
}
