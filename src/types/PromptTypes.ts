import { z } from "zod";

/**
 * Schema para una sección de prompt (fragmento o template inline)
 */
export const PromptSectionSchema = z.object({
  name: z.string(),
  file: z.string().optional(),      // Path relativo al archivo de fragmento
  template: z.string().optional(),   // Template inline (alternativa a file)
  required: z.boolean().default(true),
});

export type PromptSection = z.infer<typeof PromptSectionSchema>;

/**
 * Schema para configuración de un prompt específico
 */
export const PromptConfigSchema = z.object({
  description: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().positive().optional(),
  sections: z.array(PromptSectionSchema),
});

export type PromptConfig = z.infer<typeof PromptConfigSchema>;

/**
 * Schema para el archivo completo de configuración de prompts
 */
export const PromptConfigFileSchema = z.object({
  $schema: z.string().optional(),
  version: z.string().optional(),
  description: z.string().optional(),
  prompts: z.record(z.string(), PromptConfigSchema),
});

export type PromptConfigFile = z.infer<typeof PromptConfigFileSchema>;

/**
 * Prompt cargado con su configuración
 */
export interface LoadedPrompt {
  name: string;
  config: PromptConfig;
  assembledPrompt: string;
  variables: Record<string, any>;
}
