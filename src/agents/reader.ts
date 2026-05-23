import { FileReaderTool } from "../tools/fileReader.js";
import { JsonParserTool } from "../tools/jsonParser.js";
import { RepoExplorerTool } from "../tools/repoExplorer.js";
import type { ChatLLM } from "../config/llm.js";
import type {
  ResolvedFlowDefinition,
  LoadedSchema,
  SourceHints,
} from "../types/index.js";
import { SchemaLoader } from "../engines/SchemaLoader.js";

export interface ReaderAgentInput {
  flowDefinition: ResolvedFlowDefinition;
  dependencies?: Record<string, any>;
}

export interface SourceData {
  schema: LoadedSchema;
  sourceHints: SourceHints;
  build?: any;
  release?: any;
  repoFiles: Array<{
    path: string;
    relativePath: string;
    extension: string;
    content?: string;
  }>;
  dependencies?: Record<string, any>;
  flowName: string;
}

/**
 * ReaderAgent - Lee y consolida datos desde múltiples fuentes
 * Usa sourceHints del schema para filtrar archivos relevantes
 */
export class ReaderAgent {
  private fileReader: FileReaderTool;
  private jsonParser: JsonParserTool;
  private repoExplorer: RepoExplorerTool;
  private schemaLoader: SchemaLoader;

  constructor(_llm: ChatLLM) {
    this.fileReader = new FileReaderTool();
    this.jsonParser = new JsonParserTool();
    this.repoExplorer = new RepoExplorerTool();
    this.schemaLoader = new SchemaLoader();
  }

  async read(input: ReaderAgentInput): Promise<SourceData> {
    const { flowDefinition, dependencies } = input;

    console.log(
      `\n[ReaderAgent] Starting data collection for flow: ${flowDefinition.name}`,
    );
    console.log(
      `[ReaderAgent] Schema: ${flowDefinition.resolvedSchemaPath}`,
    );

    // 1. Cargar schema con sourceHints
    console.log("[Reading] Schema with sourceHints...");
    const schema = await this.schemaLoader.loadSchema(
      flowDefinition.resolvedSchemaPath,
    );
    console.log(`[OK] Schema loaded: ${schema.sourceHints.description}`);
    console.log(
      `[SourceHints] Extensions: ${schema.sourceHints.fileExtensions.join(", ")}`,
    );
    console.log(
      `[SourceHints] Priority: ${schema.sourceHints.priority.join(" > ")}`,
    );

    // Si hay operationName en el contexto, agregar filtros específicos de operación
    if (flowDefinition.operationName) {
      const operationName = flowDefinition.operationName;
      console.log(
        `[OperationFilter] Filtering files for operation: ${operationName}`,
      );

      // Agregar patterns específicos de la operación a los sourceHints
      const operationPatterns = [
        `*${operationName}*`,
        `**/${operationName}/**`,
        `**/${operationName}.feature`,
        `**/messages/${operationName}/**`,
        `**/${operationName}.wsdl`,
        `**/${operationName}.xml`,
      ];

      // Combinar patterns existentes con los de operación
      schema.sourceHints.patterns = [
        ...(schema.sourceHints.patterns || []),
        ...operationPatterns,
      ];

      console.log(
        `[OperationFilter] Added ${operationPatterns.length} operation-specific patterns`,
      );
    }

    // 2. Leer fuentes según disponibilidad y prioridad
    let build: any = undefined;
    let release: any = undefined;

    if (flowDefinition.sources.build) {
      console.log(
        `[Reading] build.json from: ${flowDefinition.sources.build}`,
      );
      build = await this.readJsonSource(flowDefinition.sources.build);
      console.log("[OK] build.json loaded successfully");
    }

    if (flowDefinition.sources.release) {
      console.log(
        `[Reading] release.json from: ${flowDefinition.sources.release}`,
      );
      release = await this.readJsonSource(flowDefinition.sources.release);
      console.log("[OK] release.json loaded successfully");
    }

    // 3. Explorar repositorio usando sourceHints
    let repoFiles: Array<{
      path: string;
      relativePath: string;
      extension: string;
      content?: string;
    }> = [];

    if (flowDefinition.sources.repo) {
      console.log(
        `[Exploring] repository at: ${flowDefinition.sources.repo}`,
      );
      console.log(
        `[Filter] Using extensions from sourceHints: ${schema.sourceHints.fileExtensions.join(", ")}`,
      );

      const repoResult = await this.repoExplorer.run({
        repoPath: flowDefinition.sources.repo,
        extensions: schema.sourceHints.fileExtensions,
        maxDepth: 10,
        includeContent: true,
      });

      if (!repoResult.success) {
        throw new Error(`Failed to explore repository: ${repoResult.error}`);
      }

      repoFiles = repoResult.files;

      // Filtrar por directorios si sourceHints lo especifica
      if (schema.sourceHints.directories && schema.sourceHints.directories.length > 0) {
        const directoriesFilter = schema.sourceHints.directories;
        const filteredFiles = repoFiles.filter((file) =>
          directoriesFilter.some((dir) => file.relativePath.includes(dir))
        );

        console.log(
          `[Filter] Files filtered by directories: ${repoFiles.length} → ${filteredFiles.length}`,
        );
        repoFiles = filteredFiles;
      }

      // Filtrar por patterns si sourceHints lo especifica
      if (schema.sourceHints.patterns && schema.sourceHints.patterns.length > 0) {
        const patterns = schema.sourceHints.patterns;
        const filteredFiles = repoFiles.filter((file) =>
          patterns.some((pattern) => {
            // Convertir pattern glob a regex simple
            const regex = new RegExp(
              pattern.replace(/\*/g, ".*").replace(/\?/g, "."),
            );
            return regex.test(file.relativePath);
          })
        );

        console.log(
          `[Filter] Files filtered by patterns: ${repoFiles.length} → ${filteredFiles.length}`,
        );
        repoFiles = filteredFiles;
      }

      console.log(
        `[OK] Found ${repoFiles.length} relevant files in repository`,
      );
    }

    // 4. Retornar datos consolidados
    return {
      schema,
      sourceHints: schema.sourceHints,
      build,
      release,
      repoFiles,
      dependencies,
      flowName: flowDefinition.name,
    };
  }

  /**
   * Helper para leer y parsear fuentes JSON
   */
  private async readJsonSource(filePath: string): Promise<any> {
    const content = await this.fileReader.run({ filePath });
    if (!content.success) {
      throw new Error(
        `Failed to read JSON source ${filePath}: ${content.error}`,
      );
    }

    const parsed = await this.jsonParser.run({
      jsonString: content.content!,
    });
    if (!parsed.success) {
      throw new Error(
        `Failed to parse JSON source ${filePath}: ${parsed.error}`,
      );
    }

    return parsed.data;
  }
}
