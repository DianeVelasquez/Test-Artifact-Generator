# Test-Artifact-Generator

Test-Artifact-Generator is a technology-aware QA automation assistant that inspects existing service repositories and generates BDD, Karate, and critical-route test artifacts.

The first product increment focuses on one useful outcome: read a service repository, identify its technology profile and operations, then generate auditable QA artifacts that help automation engineers start faster.

## Product Direction

This project is being productized in stages:

1. Test-Artifact-Generator
2. Technology-specific QA profiles
3. Client-specific automation factory

The current codebase keeps the reusable multi-agent engine while moving product behavior into QA-focused profiles, schemas, and templates.

## What It Does Now

- Reads configured sources from `resources/build.json`, `resources/release.json`, and `resources/repo`.
- Uses `sourceHints` to focus repository discovery on relevant files.
- Detects a technology profile such as `spring-boot-rest`, `soap-ace-legacy`, or `generic-api`.
- Extracts Spring Boot REST operations deterministically from controller annotations before using an LLM fallback.
- Extracts service metadata and BDD scenario candidates with a configurable LLM provider when deterministic evidence is incomplete.
- Writes intermediate JSON files for auditability.
- Generates Karate config, `.feature`, and critical-route artifacts.

## Architecture

```text
Reader -> Analyzer -> Writer -> ArtifactGenerator
```

| Component | Responsibility |
|-----------|----------------|
| Reader | Loads schemas and source files using `sourceHints`. |
| Analyzer | Extracts structured findings from the source data. |
| Writer | Builds and validates intermediate JSON. |
| ArtifactGenerator | Renders final artifacts from templates. |

## Current Product Pack

| Asset | Path |
|-------|------|
| Flow | `specs/flow-configuration.json` |
| Schemas | `specs/schemas/service.json`, `specs/schemas/operation.json`, `specs/schemas/bddScenarios.json` |
| Templates | `specs/templates/KarateConfig`, `specs/templates/Feature`, `specs/templates/RutaCritica` |
| Output JSON | `output/intermediate-data/` |
| Output artifacts | `output/artifacts/` |

## Technology Profiles

| Profile | Detection Signals | Generated Focus |
|---------|-------------------|-----------------|
| `spring-boot-rest` | `pom.xml`, `build.gradle`, `@RestController`, `@RequestMapping`, `application.yml`, OpenAPI/Swagger files | REST operations, Karate feature files, route-critical scenarios |
| `soap-ace-legacy` | WSDL, XML messages, ACE/IIB-style folders, SOAP-oriented `.feature` files | SOAP operations, XML request paths, Karate config |
| `generic-api` | API docs, feature files, config files, source paths without a stronger profile match | Best-effort operations and BDD scenarios |

## Setup

Install dependencies:

```bash
npm install
```

Create `.env` with your LLM provider configuration. The app reads the generic `LLM_*` variables first, then provider-specific fallbacks.

Supported `LLM_PROVIDER` values are `openai`, `openai-compatible`, `anthropic`, `gemini`, and `watsonx`. Convenience aliases are also accepted: `gpt`, `claude`, and `google`.

OpenAI / GPT:

```env
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=your-openai-api-key
```

OpenAI-compatible providers work with Ollama, LM Studio, vLLM, and compatible gateways:

```env
LLM_PROVIDER=openai-compatible
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.openai.com/v1
```

For local providers that do not require an API key, omit `LLM_API_KEY` and point `LLM_BASE_URL` at the local OpenAI-compatible endpoint.

Claude / Anthropic:

```env
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-5-sonnet-latest
LLM_API_KEY=your-anthropic-api-key
```

Gemini:

```env
LLM_PROVIDER=gemini
LLM_MODEL=gemini-1.5-pro
LLM_API_KEY=your-gemini-api-key
```

WatsonX remains available as an optional provider:

```env
LLM_PROVIDER=watsonx
WATSONX_API_KEY=your-api-key
WATSONX_PROJECT_ID=your-project-id
LLM_MODEL=ibm/granite-3-3-8b-instruct
WATSONX_URL=https://us-south.ml.cloud.ibm.com
```

Place the target service inputs under `resources/`:

```text
resources/
├── build.json
├── release.json
└── repo/
```

Run the assistant:

```bash
npm run dev
```

## Spring Boot Portfolio Demo

The repository includes a small tracked Spring Boot REST fixture under `examples/spring-boot-rest`.

Run the same product pipeline against that fixture with:

```bash
FLOW_CONFIG_PATH=specs/flow-configuration.spring-example.json npm run dev
```

Expected evidence:

| Input Signal | Product Behavior |
|--------------|------------------|
| `pom.xml` with Spring Boot parent | Detects `spring-boot-rest`. |
| `@RestController` and mapping annotations | Extracts operations without an LLM call for operation names. |
| `@PostMapping` and `@GetMapping` methods | Produces REST `action`, `relativePath`, `protocol`, and controller evidence. |
| No existing `.feature` files | Generates starter BDD scenarios from REST endpoint metadata. |

Generated outputs are written under `output/`, which is intentionally ignored by git.

## QA Artifact Fields

The MVP extraction focuses on:

- service name
- technology profile
- technology stack
- integration points
- operations
- endpoints or SOAP actions
- request and response data paths when available
- BDD scenario candidates
- critical-route scenarios

## Legacy Modernization Assets

The repository still contains the original modernization assessment pack. It remains available as an optional product pack, but the primary product direction is QA/Automation artifact generation.
