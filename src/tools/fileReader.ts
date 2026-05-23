import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

export interface FileReaderInput {
  filePath: string;
}

export interface FileReaderOutput {
  success: boolean;
  content?: string;
  error?: string;
  filePath: string;
  size?: number;
}

export class FileReaderTool {
  name = "FileReader";
  description = "Reads a file from the filesystem and returns its content";

  async run(input: FileReaderInput): Promise<FileReaderOutput> {
    const { filePath } = input;

    try {
      if (!existsSync(filePath)) {
        return {
          success: false,
          error: `File not found: ${filePath}`,
          filePath,
        };
      }

      const content = await readFile(filePath, "utf-8");
      const size = Buffer.byteLength(content, "utf-8");

      return {
        success: true,
        content,
        filePath,
        size,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        filePath,
      };
    }
  }
}
//{
//  success: true,
//  repoPath: "/mi-repo",
//  totalFiles: 1,
//  files: [
//    {
//      path: "/mi-repo/src/index.ts",
//      relativePath: "src/index.ts",
//      extension: ".ts",
//      size: 234, // tamaño en bytes
//    }
//  ]
//}