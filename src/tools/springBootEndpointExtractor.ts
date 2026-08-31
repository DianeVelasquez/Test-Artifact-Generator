import type { FieldExtractionSource } from "./fieldExtractor.js";

export interface SpringBootEndpoint {
  operationName: string;
  httpMethod: string;
  path: string;
  sourceFile: string;
}

export class SpringBootEndpointExtractorTool {
  name = "SpringBootEndpointExtractor";
  description = "Extracts REST operations from Spring Boot controller annotations.";

  extract(repoFiles: FieldExtractionSource[]): SpringBootEndpoint[] {
    const endpoints: SpringBootEndpoint[] = [];

    for (const file of repoFiles) {
      const sourceFile = file.description || file.name;
      if (!sourceFile.endsWith(".java")) {
        continue;
      }

      const content = typeof file.data === "string" ? file.data : "";
      if (!/@(RestController|Controller|RequestMapping|GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)/.test(content)) {
        continue;
      }

      const classBasePath = this.extractClassBasePath(content);
      endpoints.push(...this.extractMethods(content, classBasePath, sourceFile));
    }

    return this.deduplicate(endpoints);
  }

  private extractClassBasePath(content: string): string {
    const classIndex = content.search(/\bclass\s+\w+/);
    const classPrefix = classIndex >= 0 ? content.slice(0, classIndex) : content;
    const mappings = [...classPrefix.matchAll(/@RequestMapping\s*(?:\(([^)]*)\))?/g)];
    const lastMapping = mappings[mappings.length - 1];
    return lastMapping ? this.extractPathFromAnnotation(lastMapping[1] || "") : "";
  }

  private extractMethods(content: string, classBasePath: string, sourceFile: string): SpringBootEndpoint[] {
    const endpoints: SpringBootEndpoint[] = [];
    const classIndex = content.search(/\bclass\s+\w+/);
    const methodContent = classIndex >= 0 ? content.slice(classIndex) : content;
    const methodPattern = /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*(?:\(([^)]*)\))?([\s\S]{0,800}?)(?:public|protected|private)?\s*(?:[\w<>\[\],.?]+\s+)+(\w+)\s*\(/g;

    for (const match of methodContent.matchAll(methodPattern)) {
      const annotation = match[1];
      const args = match[2] || "";
      const betweenAnnotationAndMethod = match[3] || "";
      const operationName = match[4];

      if (/\bclass\s+\w+/.test(betweenAnnotationAndMethod)) {
        continue;
      }

      const httpMethod = this.extractHttpMethod(annotation, args);
      const methodPath = this.extractPathFromAnnotation(args);

      endpoints.push({
        operationName,
        httpMethod,
        path: this.joinPaths(classBasePath, methodPath),
        sourceFile,
      });
    }

    return endpoints;
  }

  private extractHttpMethod(annotation: string, args: string): string {
    const methodByAnnotation: Record<string, string> = {
      GetMapping: "GET",
      PostMapping: "POST",
      PutMapping: "PUT",
      DeleteMapping: "DELETE",
      PatchMapping: "PATCH",
    };

    if (methodByAnnotation[annotation]) {
      return methodByAnnotation[annotation];
    }

    const requestMethod = args.match(/method\s*=\s*RequestMethod\.(GET|POST|PUT|DELETE|PATCH)/);
    return requestMethod?.[1] || "GET";
  }

  private extractPathFromAnnotation(args: string): string {
    const pathMatch = args.match(/(?:value|path)\s*=\s*(?:\{\s*)?"([^"]+)"/) || args.match(/^\s*"([^"]+)"/);
    return pathMatch?.[1] || "";
  }

  private joinPaths(basePath: string, methodPath: string): string {
    const joined = [basePath, methodPath]
      .filter(Boolean)
      .join("/")
      .replace(/\/+/g, "/");

    if (!joined) {
      return "/";
    }

    return joined.startsWith("/") ? joined : `/${joined}`;
  }

  private deduplicate(endpoints: SpringBootEndpoint[]): SpringBootEndpoint[] {
    const unique = new Map<string, SpringBootEndpoint>();
    for (const endpoint of endpoints) {
      const key = `${endpoint.operationName}:${endpoint.httpMethod}:${endpoint.path}`;
      if (!unique.has(key)) {
        unique.set(key, endpoint);
      }
    }
    return [...unique.values()];
  }
}
