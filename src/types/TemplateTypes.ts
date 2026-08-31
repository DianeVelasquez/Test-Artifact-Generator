import { z } from "zod";

/**
 * Configuración de mapeo de campo (versión compleja)
 */
export const FieldMappingConfigSchema = z.object({
  path: z.string(),
  required: z.boolean().optional(),
  transform: z.enum(["upper", "lower", "trim"]).optional(),
  default: z.any().optional(),
});

export type FieldMappingConfig = z.infer<typeof FieldMappingConfigSchema>;

/**
 * Schema de validación para configuración de template
 */
export const TemplateConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  outputFileName: z.string(),
  enabled: z.boolean().default(true),
  mapping: z.record(
    z.string(),
    z.union([z.string(), FieldMappingConfigSchema]),
  ),
});

export type TemplateConfig = z.infer<typeof TemplateConfigSchema>;

/**
 * Template cargado con contenido y configuración
 */
export interface LoadedTemplate {
  name: string;
  config: TemplateConfig;
  templateContent: string;
  templatePath: string;
  configPath: string;
}

/**
 * Archivo generado por el ArtifactGeneratorAgent
 */
export interface GeneratedArtifact {
  templateName: string;
  fileName: string;
  filePath: string;
  content: string;
  size: number;
}

/**
 * Resultado de generación de artefactos
 */
export interface GenerationResult {
  success: boolean;
  artifacts: GeneratedArtifact[];
  errors?: string[];
}
