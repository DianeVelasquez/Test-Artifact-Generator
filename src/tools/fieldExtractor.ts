import type { ChatLLM } from "../config/llm.js";
import { PromptLoader } from "../engines/PromptLoader.js";
import type { ResolvedFlowDefinition } from "../types/index.js";

export interface FieldExtractionSource {
  name: string;
  data: any;
  description?: string;
}

export interface FieldExtractionInput {
  schema: any;
  sources: FieldExtractionSource[];
  flowDefinition: ResolvedFlowDefinition; // Add flowDefinition to the input
}

export interface ExtractedField {
  fieldName: string;
  value: any;
  source: string;
  confidence: "high" | "medium" | "low";
  reasoning?: string;
}

export interface FieldExtractorOutput {
  success: boolean;
  extractedFields: ExtractedField[];
  error?: string;
  rawResponse?: string;
}

export class FieldExtractorTool {
  name = "FieldExtractor";
  description = "Intelligently extracts fields from multiple data sources using an LLM";
  private promptLoader: PromptLoader;
  private llm: ChatLLM;

  constructor(llm: ChatLLM) {
    this.llm = llm;
    this.promptLoader = new PromptLoader();
  }

  async run(input: FieldExtractionInput): Promise<FieldExtractorOutput> {
    const {
      schema,
      sources,
      flowDefinition, // Destructure flowDefinition
    } = input;

    try {
      // Pass flowDefinition to the prompt builder
      const prompt = await this.buildExtractionPrompt(schema, sources, flowDefinition);

      console.log(`[FieldExtractor] Calling ${this.llm.provider} API with ${this.llm.model}...`);
      const rawResponse = await this.llm.complete(prompt, {
        temperature: 0.1,
        maxTokens: 4096,
      });
      console.log("[FieldExtractor] Response received successfully");

      const extractedFields = this.parseLLMResponse(rawResponse);

      return {
        success: true,
        extractedFields,
        rawResponse,
      };
    } catch (error) {
      console.error("[FieldExtractor] Error details:");
      console.error("Error type:", error instanceof Error ? error.constructor.name : typeof error);
      console.error("Error message:", error instanceof Error ? error.message : String(error));

      // Try to get the underlying cause
      if (error && typeof error === 'object') {
        const err = error as any;
        if (err.cause) {
          console.error("Error cause:", err.cause);
        }
        if (err.errors) {
          console.error("Error errors array:", err.errors);
        }
        if (err.response) {
          console.error("Error response:", err.response);
        }
        if (err.request) {
          console.error("Error request:", err.request);
        }
        // Log all properties
        console.error("All error properties:", Object.keys(err));
        console.error("Error object:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      }

      if (error instanceof Error && error.stack) {
        console.error("Stack trace:", error.stack);
      }

      return {
        success: false,
        extractedFields: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Builds the extraction prompt using PromptLoader (externalized prompts)
   */
  private async buildExtractionPrompt(schema: any, sources: FieldExtractionSource[], flowDefinition: ResolvedFlowDefinition): Promise<string> {
    const schemaStr = JSON.stringify(schema, null, 2);
    const sourcesStr = sources
      .map((source) => {
        const dataPreview = this.truncateData(source.data, 1000);
        return `
### Source: ${source.name}
${source.description ? `Description: ${source.description}` : ""}
Data Preview:
\`\`\`json
${JSON.stringify(dataPreview, null, 2)}
\`\`\`
`;
      })
      .join("\n");

    const operationName = flowDefinition.operationName;

    // Load prompt from external configuration
    try {
      return await this.promptLoader.loadPrompt("fieldExtraction", {
        schema: schemaStr,
        sources: sourcesStr,
        operationName: operationName,
      });
    } catch (error) {
      console.warn("[FieldExtractor] Failed to load external prompt, using fallback");
      console.warn("Error:", error instanceof Error ? error.message : String(error));

      // Fallback to basic prompt if external loading fails
      return `You are an intelligent data extraction system.

## OUTPUT SCHEMA
\`\`\`json
${schemaStr}
\`\`\`

## DATA SOURCES
${sourcesStr}

${operationName ? `## SINGLE OPERATION CONTEXT\nIMPORTANT: You are extracting data for ONE SINGLE operation named: **${operationName}**. All extracted data must relate only to this operation.\n` : ''}

## TASK
Extract values for each field in the schema from the provided data sources.

## OUTPUT FORMAT
Respond with a JSON array:
\`\`\`json
[
  {
    "fieldName": "field_name",
    "value": "extracted_value",
    "source": "source_name",
    "confidence": "high|medium|low",
    "reasoning": "explanation"
  }
]
\`\`\`

ONLY return the JSON array.`;
    }
  }

  private parseLLMResponse(response: string): ExtractedField[] {
    try {
      // Strategy 1: Try to extract from markdown code blocks
      const jsonMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1].trim());
          if (Array.isArray(parsed)) {
            return this.mapToExtractedFields(parsed);
          }
        } catch (e) {
          console.warn("Failed to parse markdown block, trying other strategies...");
        }
      }

      // Strategy 2: Find JSON array boundaries in the response
      // Look for [...] pattern and extract just that
      const arrayStart = response.indexOf('[');
      const arrayEnd = response.lastIndexOf(']');

      if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
        const jsonStr = response.substring(arrayStart, arrayEnd + 1);

        try {
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed)) {
            return this.mapToExtractedFields(parsed);
          }
        } catch (parseError) {
          console.warn("Failed to parse extracted array, attempting recovery...");

          // Strategy 2.5: Try to parse individual objects from malformed array
          const recovered = this.recoverFromMalformedJSON(jsonStr);
          if (recovered.length > 0) {
            console.log(`✓ Recovered ${recovered.length} fields from malformed JSON`);
            return recovered;
          }
        }
      }

      // Strategy 3: Try parsing the whole response
      const parsed = JSON.parse(response.trim());
      if (Array.isArray(parsed)) {
        return this.mapToExtractedFields(parsed);
      }

      throw new Error("Response is not an array");
    } catch (error) {
      console.error("Failed to parse LLM response:", error);
      console.error("Raw response:", response);

      // Last resort: try to extract individual objects
      const recovered = this.recoverFromMalformedJSON(response);
      if (recovered.length > 0) {
        console.log(`✓ Recovered ${recovered.length} fields from completely malformed response`);
        return recovered;
      }

      return [];
    }
  }

  /**
   * Attempts to recover valid field objects from malformed JSON
   * Extracts individual objects even if the overall structure is broken
   */
  private recoverFromMalformedJSON(jsonStr: string): ExtractedField[] {
    const recovered: ExtractedField[] = [];

    try {
      // Try to split by objects and parse each individually
      // Look for patterns like { "fieldName": "...", ... }
      const objectPattern = /\{\s*"fieldName"\s*:\s*"([^"]+)"\s*,[\s\S]*?"value"\s*:\s*(\{[\s\S]*?\}|"[^"]*"|\[[\s\S]*?\]|[\d.]+|true|false|null)\s*,[\s\S]*?\}/g;

      let match;
      while ((match = objectPattern.exec(jsonStr)) !== null) {
        try {
          const objStr = match[0];
          const parsed = JSON.parse(objStr);

          if (parsed.fieldName && parsed.value !== undefined) {
            recovered.push({
              fieldName: parsed.fieldName,
              value: parsed.value,
              source: parsed.source || "unknown",
              confidence: parsed.confidence || "medium",
              reasoning: parsed.reasoning,
            });
          }
        } catch (e) {
          // Skip this object, continue with next
          continue;
        }
      }
    } catch (e) {
      console.warn("Recovery attempt failed:", e);
    }

    return recovered;
  }

  private mapToExtractedFields(parsed: any[]): ExtractedField[] {
    return parsed.map((field) => ({
      fieldName: field.fieldName || "",
      value: field.value,
      source: field.source || "unknown",
      confidence: field.confidence || "medium",
      reasoning: field.reasoning,
    }));
  }

  private truncateData(data: any, maxLength: number): any {
    const str = JSON.stringify(data);
    if (str.length <= maxLength) {
      return data;
    }

    if (typeof data === "object" && data !== null) {
      if (Array.isArray(data)) {
        return {
          _type: "array",
          length: data.length,
          sample: data.slice(0, 2),
        };
      } else {
        const keys = Object.keys(data);
        const summary: any = {
          _type: "object",
          _keys: keys,
        };
        for (let i = 0; i < Math.min(5, keys.length); i++) {
          summary[keys[i]] = data[keys[i]];
        }
        return summary;
      }
    }

    return data;
  }
}
