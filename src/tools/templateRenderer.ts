import { PromptTemplate } from "beeai-framework/template";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

export interface TemplateRendererInput {
    templatePath?: string;
    templateContent?: string;
    data: Record<string, any>;
    useContent?: boolean;
}

export interface TemplateRendererOutput {
    success: boolean;
    rendered?: string;
    error?: string;
}

export class TemplateRendererTool {
    name = "TemplateRenderer";
    description = "Renders templates using Bee Framework's PromptTemplate with Mustache syntax";

    async run(input: TemplateRendererInput): Promise<TemplateRendererOutput> {
        const { templatePath, templateContent, data, useContent } = input;

        try {
            let content: string;

            if (useContent && templateContent) {
                // Usar contenido directo
                content = templateContent;
            } else if (templatePath) {
                // Cargar desde archivo
                if (!existsSync(templatePath)) {
                    return {
                        success: false,
                        error: `Template not found: ${templatePath}`,
                    };
                }
                content = await readFile(templatePath, "utf-8");
            } else {
                return {
                    success: false,
                    error: "Either templatePath or templateContent must be provided",
                };
            }

            // Generar schema Zod dinámico desde data
            const schema = this.buildZodSchema(data);

            // Crear template con funciones custom
            const template = new PromptTemplate({
                schema,
                template: content,
                functions: this.getCustomFunctions(),
            });

            // Enriquecer data con valores generados dinámicamente
            const enrichedData = {
                ...data,
                timestamp: new Date().toISOString(),
                uuid: randomUUID(),
                currentDate: this.getCurrentDate(),  // ← AGREGAR AQUÍ
            };

            const rendered = template.render(enrichedData);

            return {
                success: true,
                rendered,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Genera fecha actual en formato DD/MM/YYYY
     */
    private getCurrentDate(): string {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        return `${day}/${month}/${year}`;
    }

    /**
     * Genera schema Zod dinámico desde data
     * Infiere tipos de las propiedades del objeto
     */
    private buildZodSchema(data: Record<string, any>): z.ZodObject<any> {
        const shape: Record<string, z.ZodTypeAny> = {};

        // Agregar campos del data
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === "string") {
                shape[key] = z.string().optional();
            } else if (typeof value === "number") {
                shape[key] = z.number().optional();
            } else if (typeof value === "boolean") {
                shape[key] = z.boolean().optional();
            } else if (Array.isArray(value)) {
                shape[key] = z.array(z.any()).optional();
            } else if (typeof value === "object" && value !== null) {
                // Objetos anidados
                shape[key] = z.record(z.any()).optional();
            } else {
                shape[key] = z.any().optional();
            }
        }

        // Agregar campos para valores generados (siempre disponibles)
        shape.timestamp = z.string().optional();
        shape.uuid = z.string().optional();
        shape.currentDate = z.string().optional();  // ← AGREGAR AQUÍ

        return z.object(shape);
    }

    /**
     * Funciones custom para templates (compatibles con PromptTemplate)
     * Estas funciones se pueden usar en templates Mustache
     */
    private getCustomFunctions(): Record<string, () => (text: string, render: (t: string) => string) => string> {
        return {
            // upper: Convierte texto a mayúsculas
            // Uso: {{#upper}}{{text}}{{/upper}}
            upper: () => (text: string, render: (t: string) => string) => {
                return render(text).toUpperCase();
            },
            // lower: Convierte texto a minúsculas
            // Uso: {{#lower}}{{text}}{{/lower}}
            lower: () => (text: string, render: (t: string) => string) => {
                return render(text).toLowerCase();
            },
        };
    }
}