import { z } from "zod";
import { SourceHintsSchema, type SourceHints } from "./FlowConfig.js";

/**
 * Schema de validación básica para campos de dominio
 */
export const DomainFieldSchema = z.object({
  value: z.any(),
  type: z.string(),
  description: z.string(),
  required: z.boolean().optional(),
  validation: z.record(z.any()).optional(),
  examples: z.array(z.any()).optional(),
  enum: z.array(z.string()).optional(),
  enumDescriptions: z.record(z.string()).optional(),
  schema: z.record(z.any()).optional(),
});

export type DomainField = z.infer<typeof DomainFieldSchema>;

/**
 * Schema de validación para schemas con sourceHints
 */
export const SchemaWithHintsSchema = z.object({
  sourceHints: SourceHintsSchema,
  data: z.record(z.any()).optional(),
  scenarios: z.record(z.any()).optional(),
});

export type SchemaWithHints = z.infer<typeof SchemaWithHintsSchema>;

/**
 * Interface para schema cargado con metadata adicional
 */
export interface LoadedSchema {
  sourceHints: SourceHints;
  data: Record<string, any>;
  raw: SchemaWithHints;
  path: string;
}
