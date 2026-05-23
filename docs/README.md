# Test-Artifact-Generator Docs

Test-Artifact-Generator uses a configurable multi-agent pipeline to inspect service repositories and generate QA automation artifacts.

## Quick Path

1. Put the target service inputs under `resources/`.
2. Configure the LLM provider with `LLM_PROVIDER`, `LLM_MODEL`, and provider credentials.
3. Run `npm run dev`.
4. Review generated JSON under `output/intermediate-data/` and artifacts under `output/artifacts/`.

## Execution Model

```text
MasterOrchestratorAgent
  -> FlowOrchestrator
    -> FlowExecutor
      -> ReaderAgent
      -> AnalyzerAgent
      -> WriterAgent
      -> ArtifactGeneratorAgent
```

## Primary Flow

| Step | Purpose |
|------|---------|
| `serviceDiscovery` | Detect service metadata, technology profile, operations, and Karate configuration. |
| `operationProcessing` | Process each discovered operation and generate BDD/Karate artifacts. |

## Technology Profiles

| Profile | Scope |
|---------|-------|
| `spring-boot-rest` | Spring Boot REST services with controller annotations, application config, and optional OpenAPI docs. |
| `soap-ace-legacy` | SOAP/ACE services with WSDL, XML messages, and legacy feature files. |
| `generic-api` | Fallback for mixed or partially documented API repositories. |

## Generated Artifacts

| Artifact | Source |
|----------|--------|
| `karate-config-{service}.js` | `serviceMetadata` intermediate JSON. |
| `{operationName}-scenarios.feature` | `bddScenarios` intermediate JSON. |
| `ruta-critica-{service}.json` | Combined modular and integration BDD scenarios. |

## Provider Boundary

The application uses the internal `ChatLLM` contract. Providers are selected by configuration, so agents and extractors do not depend directly on a specific vendor SDK.
