# Architecture: Test-Artifact-Generator

The system is a configurable multi-agent pipeline for turning repository evidence into QA automation artifacts.

The core design choice is to keep product behavior in configuration wherever possible: flows define the work, schemas define what to extract, and templates define what to generate.

## Execution Model

```text
FlowOrchestrator
  -> FlowExecutor
    -> ReaderAgent
    -> AnalyzerAgent
    -> WriterAgent
    -> ArtifactGeneratorAgent
```

| Stage | Role |
|-------|------|
| ReaderAgent | Loads schema, build/release metadata, and repository files filtered by `sourceHints`. |
| AnalyzerAgent | Detects technology profile, uses specialized extractors when available, and falls back to generic schema-based extraction. |
| WriterAgent | Converts extracted fields into the schema-shaped intermediate JSON output. |
| ArtifactGeneratorAgent | Maps JSON fields into templates and writes final artifacts. |

## Product Pack Structure

A product pack is composed of three assets:

| Asset | Purpose |
|-------|---------|
| Flow | Defines execution, sources, outputs, and templates. |
| Schema | Defines the QA data model and source discovery hints. |
| Template | Defines the generated QA artifact. |

The primary pack is the QA artifact generation flow:

```text
specs/flow-configuration.json
specs/schemas/service.json
specs/schemas/operation.json
specs/schemas/bddScenarios.json
specs/templates/KarateConfig/
specs/templates/Feature/
specs/templates/RutaCritica/
```

## Current Flow

```text
resources/build.json
resources/release.json
resources/repo/
        |
        v
serviceMetadata -> operationDiscovery -> bddScenarios
        |
        v
output/intermediate-data/*.json
output/artifacts/**/*
```

## Why This Shape

The product needs to support multiple service technologies without becoming a one-off script. Keeping the engine stable and moving domain behavior into profiles, schemas, and templates avoids rewriting the pipeline for every client or use case.

## Technology Profiles

Profiles describe how repository evidence should be interpreted before the LLM fills semantic gaps.

| Profile | Purpose |
|---------|---------|
| `spring-boot-rest` | First-class REST service profile for Spring Boot portfolio and enterprise services. |
| `soap-ace-legacy` | Legacy SOAP/ACE profile retained from the original automation assets. |
| `generic-api` | Fallback profile for repositories with partial or mixed API evidence. |

## Extension Path

Next product packs can reuse the same engine:

- Additional technology profiles such as Node/Express, .NET Web API, or Quarkus.
- Client-specific schemas, templates, validators, and delivery conventions.

## Known Couplings To Reduce Later

- Some legacy templates and schemas still describe SOAP, Scaffold, BDD, Karate, and banking migration concerns.
- Some analyzer strategies are still hardcoded for legacy flow names.
- Source types are currently limited to `build`, `release`, and `repo`.
- Some operation and BDD prompts still need more Spring Boot-specific deterministic context.

Those are intentional follow-up refactors. The MVP keeps the smallest viable QA artifact product slice first.
