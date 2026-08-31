# Test-Artifact-Generator: QA Automation Artifact Generator

Test-Artifact-Generator is a portfolio-ready QA/Automation tool that reads existing service repositories and generates auditable testing artifacts such as Karate config files, `.feature` files, BDD scenarios, operation metadata, and critical-route reports.

## Quick Path

1. Install dependencies:

```bash
npm install
```

2. Run the bundled Spring Boot REST demo:

```bash
LLM_PROVIDER=openai-compatible LLM_BASE_URL=http://127.0.0.1:9 LLM_MODEL=dummy FLOW_CONFIG_PATH=specs/flow-configuration.spring-example.json npx --no-install tsx src/index.ts
```

3. Review generated artifacts under:

```text
output/intermediate-data/
output/artifacts/
```

Expected demo result: `2/2` orchestration steps successful, `5` flows successful, `5` artifacts generated, `0` LLM calls.

## Product Goal

The product helps QA and automation engineers accelerate test creation during service modernization or onboarding. Instead of manually inspecting controllers, routes, feature files, WSDLs, and configuration files, the tool extracts repository evidence and produces a first set of testing artifacts.

## What It Generates

| Artifact | Purpose |
|----------|---------|
| `karate-config-{service}.js` | Base Karate configuration with service name, base URL, timeout, profile, and operations. |
| `{operation}-scenarios.feature` | Starter BDD/Karate feature scenarios per discovered operation. |
| `ruta-critica-{service}.json` | Critical-route style scenario summary for review and planning. |
| Intermediate JSON | Auditable extraction output for service metadata, operations, and BDD scenarios. |
| Orchestration report | Execution summary with validations, generated files, metrics, and failures if any. |

## Architecture

The design follows a clean, layered pipeline where orchestration, reading, analysis, writing, and artifact generation are separated.

```text
MasterOrchestratorAgent
  -> FlowOrchestrator
    -> FlowExecutor
      -> ReaderAgent
      -> AnalyzerAgent
      -> WriterAgent
      -> ArtifactGeneratorAgent
```

| Layer | Responsibility |
|-------|----------------|
| `ReaderAgent` | Loads configured sources and filters repository files using schema `sourceHints`. |
| `AnalyzerAgent` | Detects technology profile and delegates extraction to deterministic tools or LLM-backed tools. |
| `WriterAgent` | Builds validated intermediate JSON from extracted fields. |
| `ArtifactGeneratorAgent` | Renders final artifacts from templates. |
| Schemas/Templates | Keep product behavior configurable instead of hardcoded in the engine. |

## Clean Architecture Decisions

| Decision | Why It Matters |
|----------|----------------|
| Deterministic extraction before LLM | Facts from code, such as Spring controller mappings, should not depend on probabilistic inference. |
| Provider-neutral LLM boundary | The system supports OpenAI-compatible, OpenAI/GPT, Anthropic/Claude, Gemini, and WatsonX without coupling agents to one vendor. |
| Product packs via config | Flows, schemas, and templates can evolve independently from the execution engine. |
| Auditable intermediate JSON | Reviewers can inspect what was extracted before trusting generated artifacts. |
| Technology profiles | The product stays technology-agnostic while supporting Spring Boot REST as a first-class profile. |

## Supported Profiles

| Profile | Current Capability |
|---------|--------------------|
| `spring-boot-rest` | Detects Spring Boot metadata, controllers, endpoints, HTTP methods, paths, and generates REST BDD fallback scenarios. |
| `soap-ace-legacy` | Preserves legacy SOAP/ACE-oriented schemas, WSDL/message evidence, and BDD extraction paths. |
| `generic-api` | Provides a fallback path when the repository has partial or mixed API evidence. |

## Spring Boot Demo

The tracked demo fixture lives at:

```text
examples/spring-boot-rest/
```

It includes:

| File | Role |
|------|------|
| `build.json` | Build metadata sample. |
| `release.json` | Runtime/base URL metadata sample. |
| `repo/pom.xml` | Spring Boot Maven signal. |
| `repo/src/main/resources/application.yml` | Spring application metadata. |
| `repo/src/main/java/com/example/customer/CustomerController.java` | REST endpoints used by deterministic extraction. |

The demo proves the tool can generate QA artifacts from Spring Boot source code without requiring an LLM for the happy path.

## Verification Commands

Run TypeScript verification:

```bash
npx --no-install tsc --noEmit --pretty false
```

Run the portfolio demo:

```bash
LLM_PROVIDER=openai-compatible LLM_BASE_URL=http://127.0.0.1:9 LLM_MODEL=dummy FLOW_CONFIG_PATH=specs/flow-configuration.spring-example.json npx --no-install tsx src/index.ts
```

The dummy LLM endpoint is intentional. If the deterministic demo accidentally calls the LLM, the run fails. A successful run with this command proves the Spring Boot demo path is deterministic.

## Sprint 1 Status

| Item | Status |
|------|--------|
| Product identity updated to `Test-Artifact-Generator` | Complete |
| Spring Boot REST profile | Complete |
| Deterministic endpoint extraction | Complete |
| Deterministic Spring operation details | Complete |
| REST BDD fallback generation | Complete |
| Portfolio fixture and demo flow | Complete |
| Updated README and architecture docs | Complete |
| TypeScript verification | Complete |
| End-to-end demo verification | Complete |

## Next Sprint Candidates

| Candidate | Value |
|-----------|-------|
| Add automated tests for extractors | Protects deterministic parsing and avoids regressions. |
| Improve generated Karate syntax | Moves starter `.feature` files closer to executable Karate tests. |
| Add Node/Express or .NET Web API profile | Shows the product is truly multi-technology. |
| Add OpenAPI parsing | Improves support for repositories with API specs but limited source access. |
| Improve route-critical scoring | Makes `ruta-critica` more valuable for QA planning. |

## Portfolio Pitch

Test-Artifact-Generator demonstrates practical QA automation architecture: it combines deterministic static analysis, configurable product packs, provider-neutral AI integration, auditable intermediate outputs, and generated test artifacts. The first sprint delivers a working Spring Boot REST showcase while preserving a path for SOAP legacy systems and future technology profiles.
