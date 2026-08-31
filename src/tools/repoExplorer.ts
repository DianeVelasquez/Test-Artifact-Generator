import { readdir, readFile, stat } from "node:fs/promises";
import { join, extname, relative } from "node:path";

export interface RepoExplorerInput {
  repoPath: string;
  pattern?: string;
  extensions?: string[];
  maxDepth?: number;
  includeContent?: boolean;
}

export interface FileInfo {
  path: string;
  relativePath: string;
  extension: string;
  size: number;
  content?: string;
}

export interface RepoExplorerOutput {
  success: boolean;
  files: FileInfo[];
  totalFiles: number;
  error?: string;
  repoPath: string;
}

export class RepoExplorerTool {
  name = "RepoExplorer";
  description = "Explores a repository directory and finds files matching criteria";

  async run(input: RepoExplorerInput): Promise<RepoExplorerOutput> {
    const { repoPath, pattern, extensions, maxDepth = 10, includeContent = false } = input;

    try {
      const files: FileInfo[] = [];
      await this.exploreDirectory(repoPath, repoPath, files, 0, maxDepth, pattern, extensions, includeContent);

      return {
        success: true,
        files,
        totalFiles: files.length,
        repoPath,
      };
    } catch (error) {
      return {
        success: false,
        files: [],
        totalFiles: 0,
        error: error instanceof Error ? error.message : String(error),
        repoPath,
      };
    }
  }

  private async exploreDirectory(
    basePath: string,
    currentPath: string,
    results: FileInfo[],
    currentDepth: number,
    maxDepth: number,
    pattern?: string,
    extensions?: string[],
    includeContent = false
  ): Promise<void> {
    if (currentDepth >= maxDepth) {
      return;
    }

    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await this.exploreDirectory(
          basePath,
          fullPath,
          results,
          currentDepth + 1,
          maxDepth,
          pattern,
          extensions,
          includeContent
        );
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        const relativePath = relative(basePath, fullPath);

        let matches = true;

        if (pattern && !entry.name.includes(pattern)) {
          matches = false;
        }

        if (extensions && extensions.length > 0 && !extensions.includes(ext)) {
          matches = false;
        }

        if (matches) {
          const stats = await stat(fullPath);
          const fileInfo: FileInfo = {
            path: fullPath,
            relativePath,
            extension: ext,
            size: stats.size,
          };

          if (includeContent) {
            try {
              fileInfo.content = await readFile(fullPath, "utf-8");
            } catch {
              fileInfo.content = "[Binary or unreadable file]";
            }
          }

          results.push(fileInfo);
        }
      }
    }
  }
}
// {
//   success: true,
//   repoPath: "/mi-repo",
//   totalFiles: 1,
//   files: [
//     {
//       path: "/mi-repo/src/index.ts",
//       relativePath: "src/index.ts",
//       extension: ".ts",
//       size: 234, // tamaño en bytes
//     }
//   ]
// }