import type { FieldExtractionSource } from "./fieldExtractor.js";

export type TechnologyProfile = "spring-boot-rest" | "soap-ace-legacy" | "generic-api";

export interface TechnologyProfileResult {
  profile: TechnologyProfile;
  confidence: "high" | "medium" | "low";
  signals: string[];
}

export class TechnologyProfileDetectorTool {
  name = "TechnologyProfileDetector";
  description = "Detects the service technology profile from repository files.";

  detect(repoFiles: FieldExtractionSource[]): TechnologyProfileResult {
    const signals: string[] = [];
    let springScore = 0;
    let soapScore = 0;

    for (const file of repoFiles) {
      const path = (file.description || file.name).toLowerCase();
      const content = typeof file.data === "string" ? file.data : "";

      if (path.endsWith("pom.xml") || path.endsWith("build.gradle") || path.endsWith("build.gradle.kts")) {
        if (/spring-boot|org\.springframework\.boot/i.test(content)) {
          springScore += 3;
          signals.push(`${file.description}: Spring Boot build metadata`);
        }
      }

      if (/@RestController|@RequestMapping|@GetMapping|@PostMapping|@PutMapping|@DeleteMapping|@PatchMapping/.test(content)) {
        springScore += 4;
        signals.push(`${file.description}: Spring MVC controller annotations`);
      }

      if (path.includes("application.yml") || path.includes("application.yaml") || path.includes("application.properties")) {
        springScore += 1;
        signals.push(`${file.description}: Spring-style application configuration`);
      }

      if (path.includes("openapi") || path.includes("swagger")) {
        springScore += 1;
        signals.push(`${file.description}: API specification signal`);
      }

      if (path.endsWith(".wsdl") || /<wsdl:definitions|<definitions|soap:binding/i.test(content)) {
        soapScore += 4;
        signals.push(`${file.description}: WSDL/SOAP contract`);
      }

      if (path.includes("/messages/") && path.endsWith(".xml")) {
        soapScore += 2;
        signals.push(`${file.description}: XML message fixture`);
      }

      if (/app connect enterprise|\bace\b|integration bus|\biib\b/i.test(content)) {
        soapScore += 2;
        signals.push(`${file.description}: ACE/IIB integration signal`);
      }
    }

    if (springScore >= 4 && springScore >= soapScore) {
      return {
        profile: "spring-boot-rest",
        confidence: springScore >= 7 ? "high" : "medium",
        signals: signals.slice(0, 10),
      };
    }

    if (soapScore >= 4) {
      return {
        profile: "soap-ace-legacy",
        confidence: soapScore >= 7 ? "high" : "medium",
        signals: signals.slice(0, 10),
      };
    }

    return {
      profile: "generic-api",
      confidence: signals.length > 0 ? "low" : "low",
      signals: signals.slice(0, 10),
    };
  }
}
