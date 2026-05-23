import type { ChatLLM } from "../config/llm.js";
import type { FieldExtractionSource } from "./fieldExtractor.js";
import type { ResolvedFlowDefinition } from "../types/index.js";
import { SpringBootEndpointExtractorTool } from "./springBootEndpointExtractor.js";

export interface OperationDetailExtractorInput {
  repoFiles: FieldExtractionSource[];
  flowDefinition: ResolvedFlowDefinition;
  schema: any;
}

export interface OperationDetailExtractorOutput {
  success: boolean;
  data?: any;
  error?: string;
  rawResponse?: string;
}

/**
 * OperationDetailExtractorTool
 * A specialized tool to extract all details for a SINGLE operation.
 */
export class OperationDetailExtractorTool {
  name = "OperationDetailExtractor";
  description = "Extracts all details for a single operation based on the operation.json schema.";

  private springBootEndpointExtractor = new SpringBootEndpointExtractorTool();

  constructor(private llm: ChatLLM) {}

  private buildPrompt(
    repoFiles: FieldExtractionSource[],
    schema: any,
    operationName: string
  ): string {
    const fileContents = repoFiles
      .map(f => {
        const content = f.data || '';
        if (content.trim()) {
          return `
---
File: ${f.description} // This is the file's relative path
\`\`\`
${content.substring(0, 3000)}
\`\`\`
---
`;
        }
        return null;
      })
      .filter(Boolean)
      .join('\n');

    const targetSchema = { ...schema };
    // The LLM shouldn't extract operationName, it's an input parameter
    delete targetSchema.operationName; 

    return `You are a specialized data extraction system.

## CONTEXT
You are extracting all details for ONE SINGLE operation named: **${operationName}**

## TASK
Your ONLY task is to analyze the provided source files and extract the information required to populate the fields in the JSON schema below. Every piece of information you extract MUST be strictly related to the **${operationName}** operation.

## SOURCE FILES
Here are the contents of the relevant files found in the repository. Use the file paths and content to find the answers.
${fileContents}

## TARGET SCHEMA
Populate this exact JSON structure. Do not add extra fields.

\`\`\`json
${JSON.stringify(targetSchema, null, 2)}
\`\`\`

## INSTRUCTIONS
1.  **CRITICAL: Generate Description**: You MUST provide a value for the \`description\` field. If you cannot find a comment or header that describes the operation, generate a concise, one-sentence description based on the operation name. DO NOT return \`null\` for the description.

2.  **Find Validation Evidence**: Populate every evidence path you can find.
    - For Spring Boot REST, populate \`validationSources.controllerFile\` with the controller file path and set \`validationSources.wsdlFile\` to \`null\`.
    - For SOAP/ACE, populate \`validationSources.wsdlFile\` when a .wsdl exists.
    - Populate \`validationSources.messageFolder\` or \`validationSources.featureFile\` when those files exist. Missing WSDL is acceptable for REST services.

3.  **CRITICAL: Format \`relativePath\`**: The \`relativePath\` field MUST be the operation name formatted in \`camelCase\`. It must not contain spaces.
    - **Example**: If the operation name is "enrolar medio de pago", the \`relativePath\` MUST be "enrolarMedioDePago".

4.  **Focus**: All your answers must be for the **${operationName}** operation. Ignore other operations.

5.  **Protocol/Action**: If you find a ".wsdl" file related to the operation, the \`protocol\` is "SOAP" and the \`action\` is "SOAP". Otherwise, infer "REST" and the appropriate HTTP verb from Spring mapping annotations or OpenAPI definitions.

6.  **Paths**: For SOAP fixtures, construct the full relative path from the repository root, for example: \`src/test/resources/messages/${operationName}/Success/request.xml\`. For REST services without fixtures, use \`null\`.

7.  **Complete All Fields**: Fill in every field in the TARGET SCHEMA. For required fields like those mentioned above, you must find the value. For optional fields, use \`null\` if the value cannot be found.

## OUTPUT FORMAT
Your response MUST be a single, valid JSON object that matches the TARGET SCHEMA. Do not add explanations or markdown.
`;
  }

  private parseLLMResponse(response: string): any | null {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("OperationDetailExtractorTool: No JSON object found in LLM response. Raw:", response);
        return null;
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;

    } catch (error) {
      console.error("OperationDetailExtractorTool: Failed to parse LLM response:", error);
      console.error("Raw response was:", response);
      return null;
    }
  }

  async run(input: OperationDetailExtractorInput): Promise<OperationDetailExtractorOutput> {
    const {
      repoFiles,
      flowDefinition,
      schema,
    } = input;

    const operationName = flowDefinition.operationName;
    if (!operationName) {
      return { success: false, error: "OperationDetailExtractorTool requires an operationName in the flowDefinition context." };
    }

    try {
      const deterministicEndpoint = this.springBootEndpointExtractor
        .extract(repoFiles)
        .find((endpoint) => endpoint.operationName === operationName);

      if (deterministicEndpoint) {
        const data = {
          operationName,
          description: `REST ${deterministicEndpoint.httpMethod} ${deterministicEndpoint.path} operation.`,
          action: deterministicEndpoint.httpMethod,
          relativePath: deterministicEndpoint.path,
          protocol: "REST",
          requestDataPath: null,
          responseDataPath: null,
          validationSources: {
            wsdlFile: null,
            messageFolder: null,
            featureFile: null,
            controllerFile: deterministicEndpoint.sourceFile,
          },
        };

        return {
          success: true,
          data,
          rawResponse: JSON.stringify(data),
        };
      }

      const prompt = this.buildPrompt(repoFiles, schema, operationName); 
      
      const rawResponse = await this.llm.complete(prompt, {
        temperature: 0.0,
        maxTokens: 4096,
      });
      const data = this.parseLLMResponse(rawResponse);

      if (!data) {
        return { success: false, error: "Failed to parse a valid JSON object from the LLM response.", rawResponse };
      }

      return {
        success: true,
        data,
        rawResponse,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
