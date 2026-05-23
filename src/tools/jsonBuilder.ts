import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync } from "node:fs";

export interface FieldValue {
  fieldName: string;
  value: any;
}

export interface JsonBuilderInput {
  schema: any;
  fieldValues: FieldValue[];
  outputPath: string;
  pretty?: boolean;
}

export interface JsonBuilderOutput {
  success: boolean;
  outputPath?: string;
  json?: string;
  error?: string;
  validationErrors?: string[];
}

export class JsonBuilderTool {
  name = "JsonBuilder";
  description = "Builds a JSON file following a schema and validates the structure";

  /**
   * Recursively sanitizes a value.
   * - For strings: removes newlines, tabs, collapses spaces, and trims.
   * - For arrays: sanitizes each item.
   * - For objects: sanitizes each property value.
   * @param value The value to sanitize.
   */
  private sanitizeValue(value: any): any {
    if (typeof value === 'string') {
      return value.replace(/(\\r\\n|\\n|\\r|\\t)/gm, " ").replace(/\\s\\s+/g, ' ').trim();
    }
    if (Array.isArray(value)) {
      return value.map(item => this.sanitizeValue(item));
    }
    if (typeof value === 'object' && value !== null) {
      const sanitizedObject: { [key: string]: any } = {};
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          sanitizedObject[key] = this.sanitizeValue(value[key]);
        }
      }
      return sanitizedObject;
    }
    // Return other types (number, boolean, null) as they are
    return value;
  }

  async run(input: JsonBuilderInput): Promise<JsonBuilderOutput> {
    const { schema, fieldValues, outputPath, pretty = true } = input;

    try {
      const result = this.buildJsonFromSchema(schema, fieldValues);
      const validationErrors = this.validateOutput(result, schema);

      if (validationErrors.length > 0) {
        return {
          success: false,
          validationErrors,
          error: "Validation failed: " + validationErrors.join(", "),
        };
      }

      const jsonString = pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result);

      const outputDir = dirname(outputPath);
      if (!existsSync(outputDir)) {
        await mkdir(outputDir, { recursive: true });
      }

      await writeFile(outputPath, jsonString, "utf-8");

      return {
        success: true,
        outputPath,
        json: jsonString,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private buildJsonFromSchema(schema: any, fieldValues: FieldValue[]): any {
    const valueMap = new Map<string, any>();
    for (const fv of fieldValues) {
      valueMap.set(fv.fieldName, this.sanitizeValue(fv.value)); // Sanitize values as they are put into the map
    }
    return this.buildNode(schema, valueMap, "");
  }

  private buildNode(node: any, valueMap: Map<string, any>, currentPath: string): any {
    if (typeof node !== "object" || node === null) {
      return node;
    }

    if (Array.isArray(node)) {
      return [...node];
    }

    const result: any = {};

    for (const [key, fieldDef] of Object.entries(node)) {
      const fieldPath = currentPath ? `${currentPath}.${key}` : key;

      if (typeof fieldDef !== "object" || fieldDef === null) {
        result[key] = valueMap.get(fieldPath) ?? valueMap.get(key) ?? fieldDef;
        continue;
      }

      if (Array.isArray(fieldDef)) {
        result[key] = [...fieldDef];
        continue;
      }

      const fieldType = (fieldDef as any).type;
      const hasSchema = "schema" in fieldDef;
      const hasDefault = "default" in fieldDef;
      const metadataKeys = ["type", "description", "required", "enum", "enumDescriptions", "validation", "examples", "default", "schema"];
      const hasMetadata = metadataKeys.some(k => k in fieldDef);

      if (hasMetadata) {
        let extractedValue: any = undefined;
        const pathVariations = [
          fieldPath,
          fieldPath.replace(/\.schema\./g, "."),
          fieldPath.replace(/^data\./, ""),
          key
        ];
        for (const path of pathVariations) {
          if (valueMap.has(path)) {
            extractedValue = valueMap.get(path);
            break;
          }
        }

        if (extractedValue === undefined && hasDefault) {
          extractedValue = (fieldDef as any).default;
        }

        // The values in valueMap are already sanitized, so we just assign them.
        if (fieldType === "array") {
          if (hasSchema && extractedValue && Array.isArray(extractedValue)) {
            result[key] = extractedValue;
          } else if (hasSchema) {
            result[key] = [];
          } else {
            result[key] = extractedValue !== undefined ? extractedValue : [];
          }
        } else if (fieldType === "object" && hasSchema) {
          if (extractedValue && typeof extractedValue === "object" && !Array.isArray(extractedValue)) {
            result[key] = extractedValue;
          } else {
            result[key] = this.buildNode(fieldDef.schema, valueMap, `${fieldPath}.schema`);
          }
        } else {
          if (extractedValue !== undefined) {
            result[key] = extractedValue;
          } else if (fieldType === "number") {
            result[key] = null;
          } else if (fieldType === "boolean") {
            result[key] = false;
          } else if (fieldType === "string") {
            result[key] = null;
          } else {
            result[key] = null;
          }
        }
      } else {
        result[key] = {};
        for (const [childKey, childDef] of Object.entries(fieldDef)) {
          result[key][childKey] = this.buildNode(
            { [childKey]: childDef },
            valueMap,
            fieldPath
          )[childKey];
        }
      }
    }

    return result;
  }

  private validateOutput(output: any, schema: any): string[] {
    const errors: string[] = [];
    this.validateNode(output, schema, "", errors);
    return errors;
  }

  /**
   * Validates a single element of an array against its schema definition
   */
  private validateArrayElement(element: any, schema: any, elementPath: string, errors: string[]): void {
    if (typeof element !== "object" || element === null) {
      errors.push(`Array element at '${elementPath}' is not an object`);
      return;
    }

    // Validate each field in the schema
    for (const [fieldName, fieldDef] of Object.entries(schema)) {
      if (typeof fieldDef === "object" && fieldDef !== null) {
        const isRequired = (fieldDef as any).required === true;
        const fieldValue = element[fieldName];

        // Check if required field is missing or empty
        if (isRequired) {
          if (fieldValue === undefined || fieldValue === null || fieldValue === "") {
            errors.push(`Required field '${fieldName}' is missing in array element at '${elementPath}'`);
          }
        }

        // Type validation
        const expectedType = (fieldDef as any).type;
        if (fieldValue !== undefined && fieldValue !== null && expectedType) {
          const actualType = Array.isArray(fieldValue) ? "array" : typeof fieldValue;
          if (expectedType === "number" && actualType === "string" && !isNaN(Number(fieldValue))) {
            // Allow string numbers to pass as numbers
          } else if (expectedType !== actualType) {
            errors.push(
              `Field '${fieldName}' in array element at '${elementPath}' has type '${actualType}' but expected '${expectedType}'`
            );
          }
        }

        // Enum validation
        const enumValues = (fieldDef as any).enum;
        if (enumValues && Array.isArray(enumValues) && fieldValue !== undefined && fieldValue !== null) {
          if (!enumValues.includes(fieldValue)) {
            errors.push(
              `Field '${fieldName}' in array element at '${elementPath}' has invalid value '${fieldValue}'. Must be one of: ${enumValues.join(", ")}`
            );
          }
        }
      }
    }
  }

  private validateNode(
    output: any,
    schema: any,
    currentPath: string,
    errors: string[],
    parentRequired: boolean = true
  ): void {
    if (typeof schema !== "object" || schema === null) {
      return;
    }

    for (const [fieldName, fieldDef] of Object.entries(schema)) {
      const fieldPath = currentPath ? `${currentPath}.${fieldName}` : fieldName;
      const outputValue = output[fieldName];

      if (typeof fieldDef !== "object" || fieldDef === null) {
        continue;
      }

      // Determine if this is a field definition or container
      const metadataKeys = ["type", "description", "required", "enum", "enumDescriptions", "validation", "examples", "default", "schema"];
      const hasMetadata = metadataKeys.some(k => k in fieldDef);

      if (!hasMetadata) {
        // Container field - validate children recursively
        if (outputValue && typeof outputValue === "object") {
          this.validateNode(outputValue, fieldDef, fieldPath, errors, parentRequired);
        }
        continue;
      }

      // Field definition - validate the value
      const isFieldRequired = (fieldDef as any).required === true;
      const shouldValidate = parentRequired && isFieldRequired;
      const fieldType = (fieldDef as any).type;
      const enumValues = (fieldDef as any).enum;
      const hasSchema = "schema" in fieldDef;

      // Required field validation
      if (shouldValidate && (outputValue === undefined || outputValue === null || outputValue === "")) {
        errors.push(`Required field '${fieldPath}' has empty value`);
        continue;
      }

      if (outputValue === undefined || outputValue === null) {
        continue;
      }

      // Type validation
      if (fieldType) {
        const actualType = Array.isArray(outputValue) ? "array" : typeof outputValue;
        if (fieldType === "number" && actualType === "string" && !isNaN(Number(outputValue))) {
          // Allow string numbers
        } else if (fieldType !== actualType) {
          errors.push(
            `Field '${fieldPath}' has type '${actualType}' but expected '${fieldType}'`
          );
        }
      }

      // Enum validation
      if (enumValues && Array.isArray(enumValues)) {
        if (Array.isArray(outputValue)) {
          // Array of enum values
          for (const item of outputValue) {
            if (!enumValues.includes(item)) {
              errors.push(
                `Field '${fieldPath}' has invalid value '${item}'. Must be one of: ${enumValues.join(", ")}`
              );
            }
          }
        } else if (!enumValues.includes(outputValue)) {
          errors.push(
            `Field '${fieldPath}' has invalid value '${outputValue}'. Must be one of: ${enumValues.join(", ")}`
          );
        }
      }

      // Array with schema validation
      if (fieldType === "array" && hasSchema && Array.isArray(outputValue)) {
        for (let i = 0; i < outputValue.length; i++) {
          const element = outputValue[i];
          this.validateArrayElement(element, fieldDef.schema, `${fieldPath}[${i}]`, errors);
        }
      }

      // Object with schema validation
      if (fieldType === "object" && hasSchema && typeof outputValue === "object") {
        this.validateNode(outputValue, fieldDef.schema, fieldPath, errors, isFieldRequired);
      }
    }
  }
}
