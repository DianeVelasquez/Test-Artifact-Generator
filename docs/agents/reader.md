# ReaderAgent

## 📋 Descripción General

El **ReaderAgent** es responsable de la **recolección inteligente de datos** desde múltiples fuentes. Lee y consolida información de `build.json`, `release.json` y archivos del repositorio, utilizando **sourceHints** del schema para filtrar archivos relevantes.

---

## 🎯 Propósito

- Leer datos desde 3 fuentes: build, release, y repositorio
- Filtrar archivos del repositorio usando sourceHints (extensiones, directorios, patrones)
- Consolidar todos los datos en un formato estructurado para el Analyzer

---

## 🔧 Tools Utilizados

| Tool | Uso |
|------|-----|
| **FileReaderTool** | Lee archivos `build.json` y `release.json` |
| **RepoExplorerTool** | Explora y filtra archivos del repositorio según sourceHints |
| **SchemaLoader** (engine) | Carga el schema con sourceHints del flujo |

---

## 📥 Input

```typescript
interface ReaderAgentInput {
  flowDefinition: ResolvedFlowDefinition;
}
```

**Campos clave**:
- `flowDefinition.resolvedSchemaPath`: Path al schema JSON
- `flowDefinition.sources.build`: Path a build.json
- `flowDefinition.sources.release`: Path a release.json
- `flowDefinition.sources.repo`: Path al repositorio

---

## 📤 Output

```typescript
interface SourceData {
  schema: LoadedSchema;           // Schema cargado con sourceHints
  sourceHints: SourceHints;       // Hints para filtrado
  build?: any;                    // Contenido de build.json
  release?: any;                  // Contenido de release.json
  repoFiles: Array<{              // Archivos del repo filtrados
    path: string;
    name: string;
    content: string;
  }>;
  flowName: string;
}
```

---

## 🔄 Flujo de Ejecución

```
1. Cargar schema con SchemaLoader
   └─ Extraer sourceHints del schema

2. Leer build.json (si existe)
   └─ Usar FileReaderTool

3. Leer release.json (si existe)
   └─ Usar FileReaderTool

4. Explorar repositorio
   └─ Usar RepoExplorerTool con sourceHints
   └─ Filtrar por:
      - fileExtensions: [".java", ".xml", ".properties"]
      - directories: ["src/main", "config"]
      - patterns: ["application*.properties"]

5. Consolidar todo en SourceData
```

---

## 📊 SourceHints - Sistema de Filtrado Inteligente

Los **sourceHints** son metadata en el schema que guían al Reader sobre qué archivos buscar:

```json
{
  "sourceHints": {
    "description": "Metadata de servicios SOAP/REST",
    "fileExtensions": [".properties", ".xml", ".java"],
    "directories": ["config", "src/main/resources"],
    "patterns": ["application*.properties", "service*.xml"],
    "priority": ["build", "release", "repo"]
  }
}
```

**Ventajas**:
- ✅ Filtra miles de archivos a solo los relevantes
- ✅ Reduce tokens enviados al LLM
- ✅ Mejora precisión de extracción
- ✅ Configurable por schema sin tocar código

---

## 💡 Ejemplo de Uso

```typescript
const readerAgent = new ReaderAgent(llm);

const sourceData = await readerAgent.read({
  flowDefinition: {
    name: "serviceMetadata",
    resolvedSchemaPath: "/path/to/schemas/service.json",
    sources: {
      build: "/path/to/build.json",
      release: "/path/to/release.json",
      repo: "/path/to/repository"
    }
  }
});

console.log(sourceData.repoFiles.length); // e.g., 4 archivos filtrados
console.log(sourceData.sourceHints.fileExtensions); // [".properties", ".xml", ...]
```

---

## 📝 Logging

```
[ReaderAgent] Starting data collection for flow: serviceMetadata
[Reading] Schema with sourceHints...
[OK] Schema loaded: Metadata de servicios SOAP/REST
[SourceHints] Extensions: .properties, .xml, .yaml, .yml, .java
[SourceHints] Priority: build > release > repo
[Reading] build.json from: /path/to/build.json
[OK] build.json loaded successfully
[OK] Found 4 relevant files in repository
```

---

## 🔗 Relaciones

- **Llamado por**: `FlowExecutor` (Fase 1)
- **Llama a**: `AnalyzerAgent` (siguiente fase)
- **Usa engines**: `SchemaLoader`
- **Usa tools**: `FileReaderTool`, `RepoExplorerTool`

---

## 📍 Ubicación

`src/agents/reader.ts`
