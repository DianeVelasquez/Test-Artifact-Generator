export interface FieldMapping {
    [templateField: string]: string | FieldMappingConfig;
}

export interface FieldMappingConfig {
    path: string;          
    transform?: string;   
    default?: any;         
    required?: boolean;    
}

export interface FieldMapperInput {
    outputJson: any;          
    mapping: FieldMapping;        
}

export interface FieldMapperOutput {
    success: boolean;
    mappedData?: Record<string, any>;
    errors?: string[];
}

export class FieldMapperTool {
    name = "FieldMapper";
    description = "Maps fields from output.json to template variables";

    async run(input: FieldMapperInput): Promise<FieldMapperOutput> {
        const { outputJson, mapping } = input;
        const errors: string[] = [];
        const mappedData: Record<string, any> = {};

        try {
            for (const [templateField, config] of Object.entries(mapping)) {
                // Si es string simple, es un path directo
                if (typeof config === "string") {
                    const value = this.getValueByPath(outputJson, config);
                    mappedData[templateField] = value || "";
                } else {
                    // Es una configuración compleja
                    let value = this.getValueByPath(outputJson, config.path);

                    // Aplicar transformaciones
                    if (config.transform && value) {
                        value = this.applyTransform(value, config.transform);
                    }

                    // Usar valor por defecto si no existe
                    if ((value === null || value === undefined || value === "") && config.default !== undefined) {
                        value = config.default;
                    }

                    // Validar requeridos
                    if (config.required && (value === null || value === undefined || value === "")) {
                        errors.push(`Required field '${templateField}' is missing or empty`);
                    }

                    mappedData[templateField] = value;
                }
            }

            if (errors.length > 0) {
                return {
                    success: false,
                    errors,
                };
            }

            return {
                success: true,
                mappedData,
            };
        } catch (error) {
            return {
                success: false,
                errors: [error instanceof Error ? error.message : String(error)],
            };
        }
    }

    private getValueByPath(obj: any, path: string): any {
        const parts = path.split(".");
        let current = obj;

        for (const part of parts) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = current[part];
        }

        return current;
    }

    private applyTransform(value: any, transform: string): any {
        if (typeof value !== "string") {
            return value;
        }

        switch (transform) {
            case "upper":
                return value.toUpperCase();
            case "lower":
                return value.toLowerCase();
            case "trim":
                return value.trim();
            case "hasItems":
                return Array.isArray(value) && value.length > 0;
            default:
                return value;
        }
    }
}