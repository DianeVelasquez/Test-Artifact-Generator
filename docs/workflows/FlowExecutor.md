# FlowExecutor

## 📋 Descripción

El **FlowExecutor** ejecuta el **pipeline completo de 4 fases** para un flujo individual. Orquesta la comunicación entre los 4 agentes (Reader, Analyzer, Writer, ArtifactGenerator) y proporciona logging detallado y estadísticas de ejecución.

---

## 🎯 Propósito

- Ejecutar el pipeline completo: Reader → Analyzer → Writer → ArtifactGenerator
- Coordinar paso de datos entre agentes
- Manejar errores y proporcionar feedback claro
- Calcular estadísticas de ejecución
- Logging detallado por fase

---

## 🔧 Agentes Utilizados

| Agente | Fase | Responsabilidad |
|--------|------|-----------------|
| **ReaderAgent** | Fase 1 | Leer fuentes de datos (build.json, release.json, repo) |
| **AnalyzerAgent** | Fase 2 | Extraer campos usando IBM WatsonX LLM |
| **WriterAgent** | Fase 3 | Construir y escribir JSON intermedio |
| **ArtifactGeneratorAgent** | Fase 4 | Generar artefactos desde templates |

---

## 📥 Input

```typescript
interface ResolvedFlowDefinition {
  name: string;                    // Nombre del flujo
  description?: string;            // Descripción
  enabled: boolean;
  schema: string;
  templates: string[];             // Templates a usar
  sources: ResolvedSources;        // Paths absolutos
  resolvedSchemaPath: string;      // Path absoluto al schema
  resolvedOutputPaths: {
    intermediate: string;          // Path al JSON intermedio
    artifacts: string;             // Directorio de artefactos
  };
}
```

---

## 📤 Output

```typescript
interface FlowResult {
  flowName: string;
  success: boolean;
  intermediateJsonPath?: string;   // Path al JSON generado
  artifacts?: Array<{
    fileName: string;
    filePath: string;
    size: number;
  }>;
  error?: string;                  // Mensaje de error (si falló)
  stats?: {
    filesRead: number;             // Archivos leídos
    fieldsExtracted: number;       // Campos extraídos
    artifactsGenerated: number;    // Artefactos generados
    executionTime: number;         // Tiempo en ms
  };
}
```

---

## 🔄 Flujo de Ejecución

```
1. Iniciar timer

2. Log: Banner de inicio con detalles del flujo

3. FASE 1: DATA COLLECTION
   └─ ReaderAgent.read(flowDefinition)
   └─ Retorna: sourceData (build, release, repo, schema)

4. FASE 2: INTELLIGENT ANALYSIS
   └─ AnalyzerAgent.analyze(sourceData)
   └─ Usa WatsonX LLM para extraer campos
   └─ Retorna: extractedFields[]

5. FASE 3: OUTPUT GENERATION
   └─ WriterAgent.write(schema, extractedFields, flowDefinition)
   └─ Construye JSON intermedio
   └─ Valida campos requeridos
   └─ Escribe archivo a disco
   └─ Si falla → lanzar error

6. FASE 4: ARTIFACT GENERATION
   └─ Leer JSON intermedio del disco
   └─ Parsear JSON
   └─ ArtifactGeneratorAgent.generate(outputJson, flowDefinition)
   └─ Genera múltiples artefactos desde templates

7. Calcular estadísticas
   └─ filesRead
   └─ fieldsExtracted
   └─ artifactsGenerated
   └─ executionTime

8. Log: Resumen final con estadísticas

9. Retornar FlowResult
```

---

## 🖥️ Logging

### Banner Inicial

```
================================================================================
🚀 EXECUTING FLOW: serviceMetadata
================================================================================
Description: Extract service metadata and generate artifacts
Schema: specs/schemas/service.json
Templates: SoapRequest, KarateConfig
================================================================================
```

### Fases

```
📖 PHASE 1: DATA COLLECTION
[ReaderAgent logs...]

🧠 PHASE 2: INTELLIGENT ANALYSIS
[AnalyzerAgent logs...]

📝 PHASE 3: OUTPUT GENERATION
[WriterAgent logs...]

🔨 PHASE 4: ARTIFACT GENERATION
[ArtifactGeneratorAgent logs...]
```

### Resumen Final (Success)

```
================================================================================
✅ FLOW COMPLETED: serviceMetadata
================================================================================
⏱️  Execution time: 45.32s
📊 Statistics:
   - Files read: 15
   - Fields extracted: 10
   - Artifacts generated: 2

📄 Intermediate JSON: /output/intermediate/serviceMetadata.json

🎨 Generated Artifacts:
   • soap-request-MyService.xml (1024 bytes)
   • karate-config-MyService.js (512 bytes)
================================================================================
```

### Resumen Final (Error)

```
================================================================================
❌ FLOW FAILED: serviceMetadata
================================================================================
Error: Failed to write intermediate JSON: Required field 'serviceName' has empty value
⏱️  Execution time: 12.45s
================================================================================
```

---

## 💡 Ejemplo de Uso

### Uso Directo

```typescript
import { FlowExecutor } from "./workflows/FlowExecutor.js";
import { createWatsonxModel } from "./config/llm.js";

const llm = createWatsonxModel();
const executor = new FlowExecutor(llm);

const flowDefinition: ResolvedFlowDefinition = {
  name: "serviceMetadata",
  description: "Extract service metadata",
  enabled: true,
  schema: "specs/schemas/service.json",
  templates: ["SoapRequest"],
  sources: {
    build: "/absolute/path/to/build.json",
    release: "/absolute/path/to/release.json",
    repo: "/absolute/path/to/repo"
  },
  resolvedSchemaPath: "/absolute/path/to/service.json",
  resolvedOutputPaths: {
    intermediate: "/output/intermediate/serviceMetadata.json",
    artifacts: "/output/artifacts/serviceMetadata/"
  }
};

const result = await executor.execute(flowDefinition);

if (result.success) {
  console.log(`Generated ${result.stats.artifactsGenerated} artifacts`);
  console.log(`Execution time: ${result.stats.executionTime}ms`);
} else {
  console.error(`Flow failed: ${result.error}`);
}
```

### Llamado desde FlowOrchestrator

```typescript
// FlowOrchestrator usa FlowExecutor internamente
const orchestrator = new FlowOrchestrator(llm);

// Ejecuta múltiples flujos en paralelo
const results = await Promise.all(
  resolvedFlows.map(flow => flowExecutor.execute(flow))
);
```

---

## 🔗 Pipeline de Datos

### Fase 1 → Fase 2

```typescript
const sourceData = await readerAgent.read({ flowDefinition });

// sourceData estructura:
{
  build: { ... },              // build.json parseado
  release: { ... },            // release.json parseado
  repoFiles: [ ... ],          // Archivos del repo filtrados
  schema: LoadedSchema         // Schema con sourceHints
}
```

### Fase 2 → Fase 3

```typescript
const analysisResult = await analyzerAgent.analyze({ sourceData });

// analysisResult estructura:
{
  extractedFields: [
    {
      fieldName: "serviceName",
      value: "MyService",
      source: "build.json",
      confidence: "high",
      reasoning: "..."
    },
    ...
  ]
}
```

### Fase 3 → Fase 4

```typescript
const writeResult = await writerAgent.write({
  schema: sourceData.schema.data,
  extractedFields: analysisResult.extractedFields,
  flowDefinition
});

// writeResult estructura:
{
  success: true,
  outputPath: "/output/intermediate/serviceMetadata.json",
  json: '{"serviceName": "MyService", ...}'
}

// Luego se lee el JSON del disco y se pasa al generador
const intermediateJson = await readFile(writeResult.outputPath, "utf-8");
const parsedJson = JSON.parse(intermediateJson);
```

### Fase 4 → Output Final

```typescript
const generationResult = await artifactGeneratorAgent.generate({
  outputJson: parsedJson,
  flowDefinition
});

// generationResult estructura:
{
  success: true,
  artifacts: [
    {
      templateName: "SoapRequest",
      fileName: "soap-request-MyService.xml",
      filePath: "/output/artifacts/soap-request-MyService.xml",
      content: "<soapenv:Envelope>...</soapenv:Envelope>",
      size: 1024
    }
  ]
}
```

---

## 🛡️ Manejo de Errores

### Error en Fase 1 (ReaderAgent)

```typescript
// Si ReaderAgent falla leyendo fuentes
throw new Error("Failed to read build.json: File not found");
```

Resultado:
```
❌ FLOW FAILED: serviceMetadata
Error: Failed to read build.json: File not found
```

### Error en Fase 2 (AnalyzerAgent)

```typescript
// Si LLM falla o no puede extraer campos
throw new Error("LLM API error: Authentication failed");
```

### Error en Fase 3 (WriterAgent)

```typescript
// Si validación falla
if (!writeResult.success) {
  throw new Error(
    `Failed to write intermediate JSON: ${writeResult.validationErrors?.join(", ")}`
  );
}
```

Ejemplo de error:
```
❌ FLOW FAILED: serviceMetadata
Error: Failed to write intermediate JSON: Required field 'serviceName' has empty value, Required field 'timeout' has empty value
```

### Error en Fase 4 (ArtifactGeneratorAgent)

```typescript
// Si template no existe o falla renderizado
throw new Error("Template 'InvalidTemplate' not found");
```

---

## 📊 Estadísticas

### filesRead

```typescript
const filesRead =
  sourceData.repoFiles.length +          // Archivos del repo
  (sourceData.build ? 1 : 0) +           // build.json
  (sourceData.release ? 1 : 0);          // release.json
```

### fieldsExtracted

```typescript
const fieldsExtracted = analysisResult.extractedFields.length;
```

### artifactsGenerated

```typescript
const artifactsGenerated = generationResult.artifacts.length;
```

### executionTime

```typescript
const startTime = Date.now();
// ... ejecutar fases ...
const executionTime = Date.now() - startTime; // En milisegundos
```

---

## 🔗 Relaciones

- **Llamado por**: `FlowOrchestrator.execute()`, `FlowOrchestrator.executeAllFlows()`
- **Crea**: `ReaderAgent`, `AnalyzerAgent`, `WriterAgent`, `ArtifactGeneratorAgent`
- **Input**: `ResolvedFlowDefinition` (de FlowConfigLoader)
- **Output**: `FlowResult` (retornado a FlowOrchestrator)

---

## 📍 Ubicación

`src/workflows/FlowExecutor.ts`
