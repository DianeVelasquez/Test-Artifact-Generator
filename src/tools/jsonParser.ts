export interface JsonParserInput {
  jsonString: string;
}

export interface JsonParserOutput {
  success: boolean;
  data?: any;
  error?: string;
  type?: string;
  keys?: string[];
}

export class JsonParserTool {
  name = "JsonParser";
  description = "Parses a JSON string and validates its structure";

  async run(input: JsonParserInput): Promise<JsonParserOutput> {
    const { jsonString } = input;

    try {
      const trimmed = jsonString.trim();

      if (!trimmed) {
        return {
          success: false,
          error: "Empty JSON string provided",
        };
      }

      const data = JSON.parse(trimmed);
      const type = Array.isArray(data) ? "array" : typeof data;
      const keys = type === "object" && data !== null ? Object.keys(data) : undefined;

      return {
        success: true,
        data,
        type,
        keys,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// {
//   success: true,
//   data: { nombre: "Lucía", edad: 30 },
//   type: "object",
//   keys: ["nombre", "edad"]
// }