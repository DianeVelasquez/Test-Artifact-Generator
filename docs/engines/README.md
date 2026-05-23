# Engines Documentation

Los **engines** son componentes de infraestructura que **cargan, validan y resuelven configuraciones** desde archivos. Proporcionan capas de abstracción para trabajar con configuraciones, schemas y templates.

---

## 📂 Engines Disponibles

### FlowConfigLoader
Carga y valida `flow-configuration.json` con validación Zod.

### SchemaLoader
Carga y valida schemas de dominio desde `specs/schemas/`.

### TemplateLoader
Carga templates desde `specs/templates/{name}/`.

### PromptLoader
Carga y ensambla prompts desde `specs/prompts/` con sistema de fragmentos modulares.

### SourceResolver
Resuelve paths relativos a absolutos y valida existencia de fuentes.

---

## 🔧 FlowConfigLoader

**Archivo**: `src/engines/FlowConfigLoader.ts`

### Propósito

- Cargar `flow-configuration.json`
- Validar estructura con Zod
- Filtrar flujos habilitados
- Resolver paths relativos a absolutos
- Reemplazar variables (e.g., `{flowName}`)

### Métodos Principales

```typescript
class FlowConfigLoader {
  async load(): Promise<FlowConfig>
  getFlow(flowName: string): FlowDefinition | undefined
  getEnabledFlows(): Array<{ name: string; definition: FlowDefinition }>
  getFlowNames(): string[]
  resolveFlowPaths(flowName: string, flowDef: FlowDefinition): ResolvedFlowDefinition
}
```

### Ejemplo de Uso

```typescript
const loader = new FlowConfigLoader();
await loader.load();

const enabledFlows = loader.getEnabledFlows();
console.log(`Loaded ${enabledFlows.length} flows`);

for (const { name, definition } of enabledFlows) {
  const resolved = loader.resolveFlowPaths(name, definition);
  console.log(`Flow: ${resolved.name}`);
  console.log(`  Schema: ${resolved.resolvedSchemaPath}`);
  console.log(`  Output: ${resolved.resolvedOutputPaths.intermediate}`);
}
```

### Path Resolution

**Antes**:
```json
{
  "sources": {
    "build": "data/sources/build.json"
  },
  "output": {
    "intermediate": "output/intermediate/{flowName}.json"
  }
}
```

**Después** (ResolvedFlowDefinition):
```typescript
{
  sources: {
    build: "/absolute/path/to/project/data/sources/build.json"
  },
  resolvedOutputPaths: {
    intermediate: "/absolute/path/to/project/output/intermediate/serviceMetadata.json"
  }
}
```

### Validación con Zod

```typescript
const FlowConfigSchema = z.object({
  $schema: z.string().optional(),
  version: z.string().optional(),
  description: z.string().optional(),
  flows: z.record(z.string(), FlowDefinitionSchema),
});

// Uso
const validated = FlowConfigSchema.parse(parsedJson);
```

**Beneficios**:
- ✅ Validación en runtime
- ✅ Mensajes de error claros
- ✅ Type safety automática

---

## 📊 SchemaLoader

**Archivo**: `src/engines/SchemaLoader.ts`

### Propósito

- Cargar schemas desde `specs/schemas/`
- Validar con Zod
- Validar sourceHints
- Extraer data o scenarios
- Retornar metadata completa

### Métodos Principales

```typescript
class SchemaLoader {
  async loadSchema(schemaPath: string): Promise<LoadedSchema>
  getSchemaName(schemaPath: string): string
  validateSourceHints(schema: SchemaWithHints): boolean
}
```

### Ejemplo de Uso

```typescript
const loader = new SchemaLoader();
const schema = await loader.loadSchema("schemas/service.json");

console.log(`Loaded schema: ${schema.path}`);
console.log(`SourceHints: ${schema.sourceHints.description}`);
console.log(`File extensions: ${schema.sourceHints.fileExtensions.join(", ")}`);
console.log(`Fields: ${Object.keys(schema.data).length}`);
```

### LoadedSchema Estructura

```typescript
interface LoadedSchema {
  sourceHints: SourceHints;      // Metadata de filtrado
  data: Record<string, any>;     // Campos de dominio
  raw: SchemaWithHints;          // Schema completo
  path: string;                  // Path absoluto del archivo
}
```

### Validación de SourceHints

```typescript
validateSourceHints(schema: SchemaWithHints): boolean {
  // Validaciones:
  // 1. description no vacía
  // 2. Al menos 1 fileExtension
  // 3. Al menos 1 priority
  // 4. fileExtensions empiezan con "."
}
```

**Errores comunes**:
```
❌ sourceHints must have a non-empty description
❌ sourceHints must have at least one fileExtension
❌ File extension "json" must start with a dot (e.g., ".json")
```

---

## 🎨 TemplateLoader

**Archivo**: `src/engines/TemplateLoader.ts`

### Propósito

- Cargar templates desde `specs/templates/{name}/`
- Leer `config.json` y `template.bbt`
- Validar configuración con Zod
- Filtrar templates habilitados
- Validar mappings

### Métodos Principales

```typescript
class TemplateLoader {
  async loadTemplate(templateName: string): Promise<LoadedTemplate>
  async loadTemplates(templateNames: string[]): Promise<LoadedTemplate[]>
  validateMapping(config: TemplateConfig): boolean
}
```

### Ejemplo de Uso

```typescript
const loader = new TemplateLoader();

// Cargar un template
const template = await loader.loadTemplate("SoapRequest");
console.log(`Loaded: ${template.name}`);
console.log(`Output: ${template.config.outputFileName}`);
console.log(`Mapping fields: ${Object.keys(template.config.mapping).length}`);

// Cargar múltiples templates
const templates = await loader.loadTemplates(["SoapRequest", "KarateConfig"]);
console.log(`Loaded ${templates.length} templates`);
```

### LoadedTemplate Estructura

```typescript
interface LoadedTemplate {
  name: string;                  // "SoapRequest"
  config: TemplateConfig;        // config.json parseado
  templateContent: string;       // template.bbt contenido
  templatePath: string;          // Path a template.bbt
  configPath: string;            // Path a config.json
}
```

### Estructura de Directorio

```
specs/templates/SoapRequest/
├── config.json       # Configuración y mapping
└── template.bbt      # Template Mustache
```

### Validación de Mapping

```typescript
validateMapping(config: TemplateConfig): boolean {
  // Validaciones:
  // 1. Al menos 1 campo mapeado
  // 2. Paths no vacíos
  // 3. Mappings complejos tienen path requerido
}
```

---

## 📝 PromptLoader

**Archivo**: `src/engines/PromptLoader.ts`

### Propósito

- Cargar prompts desde `specs/prompts/`
- Leer `prompt-config.json` con configuración de prompts
- Ensamblar fragmentos modulares de prompts
- Reemplazar variables en formato Mustache `{{variable}}`
- Sistema de prompts externos totalmente configurable

### Métodos Principales

```typescript
class PromptLoader {
  async load(): Promise<PromptConfigFile>
  async loadPrompt(promptName: string, variables: Record<string, any>): Promise<string>
  getPromptConfig(promptName: string): PromptConfig | undefined
  getAvailablePrompts(): string[]
}
```

### Ejemplo de Uso

```typescript
const loader = new PromptLoader();

// Cargar un prompt específico con variables
const prompt = await loader.loadPrompt("fieldExtraction", {
  schema: JSON.stringify(schemaObj, null, 2),
  sources: sourcesString
});

console.log(prompt);
// Prompt completo ensamblado con todas las secciones
```

### Estructura de Archivos

```
specs/prompts/
├── prompt-config.json              # Configuración central
└── fragments/
    └── field-extraction/
        ├── system-role.txt         # Rol del sistema
        ├── task-instructions.txt   # Instrucciones
        ├── important-rules.txt     # Reglas críticas
        ├── output-format.txt       # Formato de respuesta
        ├── examples.txt            # Ejemplos
        └── nested-handling.txt     # Manejo objetos anidados
```

### prompt-config.json

```json
{
  "version": "1.0.0",
  "description": "Configuration for LLM prompts",
  "prompts": {
    "fieldExtraction": {
      "description": "Prompt for extracting field values",
      "temperature": 0.1,
      "maxTokens": 4096,
      "sections": [
        {
          "name": "system-role",
          "file": "fragments/field-extraction/system-role.txt",
          "required": true
        },
        {
          "name": "schema-context",
          "template": "## OUTPUT SCHEMA\n{{schema}}\n",
          "required": true
        },
        {
          "name": "sources-context",
          "template": "## DATA SOURCES\n{{sources}}\n",
          "required": true
        }
      ]
    }
  }
}
```

### Reemplazo de Variables

El sistema usa sintaxis Mustache:

```typescript
const variables = {
  schema: JSON.stringify(schemaObj, null, 2),
  sources: "### Source: build.json\n..."
};

// En template:
// "## SCHEMA\n{{schema}}\n"

// Resultado:
// "## SCHEMA\n{...schema JSON...}\n"
```

### Ventajas del Sistema Externo

- ✅ **Configuración sin código**: Prompts en archivos `.txt`
- ✅ **Modulares**: Fragmentos reutilizables
- ✅ **Versionables**: Control de cambios en Git
- ✅ **Testing fácil**: Probar prompts sin rebuild
- ✅ **Multilenguaje**: Soporta i18n fácilmente

### Secciones Inline vs Archivos

**Desde archivo**:
```json
{
  "name": "system-role",
  "file": "fragments/field-extraction/system-role.txt",
  "required": true
}
```

**Template inline**:
```json
{
  "name": "schema-context",
  "template": "## SCHEMA\n{{schema}}\n",
  "required": true
}
```

### Validación con Zod

```typescript
const PromptSectionSchema = z.object({
  name: z.string(),
  file: z.string().optional(),
  template: z.string().optional(),
  required: z.boolean().default(true),
});

const PromptConfigFileSchema = z.object({
  version: z.string().optional(),
  prompts: z.record(z.string(), PromptConfigSchema),
});
```

**Beneficios**:
- ✅ Validación en runtime
- ✅ Mensajes de error claros
- ✅ Type safety automática

### Manejo de Errores

```typescript
// Prompt no encontrado
throw new Error(`Prompt "invalidName" not found in configuration`);

// Sección requerida falta
throw new Error(`Failed to load required section "system-role"`);

// Archivo de fragmento no existe
throw new Error(`Failed to load prompt configuration: File not found`);
```

### Uso en FieldExtractor

```typescript
// En FieldExtractorTool
private promptLoader: PromptLoader;

constructor() {
  this.promptLoader = new PromptLoader();
}

async buildExtractionPrompt(schema: any, sources: FieldExtractionSource[]): Promise<string> {
  const schemaStr = JSON.stringify(schema, null, 2);
  const sourcesStr = /* ... format sources ... */;

  // Cargar prompt ensamblado
  return await this.promptLoader.loadPrompt("fieldExtraction", {
    schema: schemaStr,
    sources: sourcesStr,
  });
}
```

---

## 🗺️ SourceResolver

**Archivo**: `src/engines/SourceResolver.ts`

### Propósito

- Resolver paths relativos a absolutos
- Validar existencia de fuentes
- Validar tipos (archivo vs directorio)
- Proporcionar errores descriptivos

### Métodos Principales

```typescript
class SourceResolver {
  async resolveSources(sources: Sources): Promise<ResolvedSources>
  async validateSources(sources: ResolvedSources): Promise<void>
  async resolveAndValidateFlowSources(flowDef: FlowDefinition): Promise<ResolvedSources>
}
```

### Ejemplo de Uso

```typescript
const resolver = new SourceResolver();

const sources = {
  build: "data/sources/build.json",
  release: "data/sources/release.json",
  repo: "data/repos/my-service"
};

// Resolver paths
const resolved = await resolver.resolveSources(sources);
console.log(resolved.build);
// /absolute/path/to/project/data/sources/build.json

// Validar existencia
try {
  await resolver.validateSources(resolved);
  console.log("All sources validated successfully");
} catch (error) {
  console.error("Validation failed:", error.message);
}
```

### Validaciones

#### 1. Existencia

```typescript
await access(sourcePath);  // Lanza error si no existe
```

#### 2. Tipo de Archivo

- **build, release**: Deben ser **archivos**
- **repo**: Debe ser **directorio**

```typescript
if (sourceType === "repo" && !stats.isDirectory()) {
  throw new Error("repo must be a directory");
}

if (sourceType !== "repo" && !stats.isFile()) {
  throw new Error("build/release must be files");
}
```

### Mensajes de Error

```
Source validation failed:
  - build: "/path/to/build.json" does not exist
  - repo: "/path/to/repo" must be a directory, but is a file
```

### Uso en FlowOrchestrator

```typescript
// En FlowOrchestrator
for (const { name, definition } of enabledFlows) {
  try {
    await sourceResolver.resolveAndValidateFlowSources(definition);
    console.log(`✓ Sources validated`);
  } catch (error) {
    console.error(`✗ Validation failed: ${error.message}`);
    // Skip flujo
  }
}
```

---

## 🔄 Flujo de Carga Completo

### En FlowOrchestrator

```
1. FlowConfigLoader.load()
   └─ Carga flow-configuration.json
   └─ Valida con Zod

2. FlowConfigLoader.getEnabledFlows()
   └─ Filtra flujos con enabled: true

3. Para cada flujo:

   a. SourceResolver.resolveAndValidateFlowSources()
      └─ Valida que build.json, release.json, repo existan

   b. FlowConfigLoader.resolveFlowPaths()
      └─ Resuelve paths absolutos
      └─ Reemplaza {flowName}

4. FlowExecutor recibe ResolvedFlowDefinition
```

### En FlowExecutor

```
1. ReaderAgent recibe resolvedFlowDefinition

2. SchemaLoader.loadSchema(resolvedSchemaPath)
   └─ Carga schema
   └─ Valida sourceHints

3. TemplateLoader.loadTemplates(templates)
   └─ Carga múltiples templates
   └─ Valida mappings

4. Usar sourceHints para filtrar archivos del repo

5. Usar templates para generar artefactos
```

---

## 🛡️ Manejo de Errores

### FlowConfigLoader

```typescript
// Archivo no encontrado
throw new Error("Failed to load flow configuration from /path: File not found");

// JSON inválido
throw new Error("Failed to load flow configuration from /path: Unexpected token");

// Validación Zod falla
throw new Error("Failed to load flow configuration from /path: [Zod errors]");
```

### SchemaLoader

```typescript
// Schema sin sourceHints
throw new Error("Schema must have 'sourceHints' field");

// sourceHints inválidos
throw new Error("sourceHints must have a non-empty description");

// File extension sin punto
throw new Error("File extension 'json' must start with a dot");
```

### TemplateLoader

```typescript
// Template no encontrado
throw new Error("Failed to load template 'InvalidTemplate': File not found");

// Mapping vacío
throw new Error("Template 'SoapRequest' has no field mappings");

// Path de mapping vacío
throw new Error("Invalid mapping for field 'serviceName': path cannot be empty");
```

### SourceResolver

```typescript
// Fuente no existe
throw new Error("Source validation failed:\n  - build: '/path' does not exist");

// Tipo incorrecto
throw new Error("Source validation failed:\n  - repo: '/path' must be a directory");
```

---

## 🔗 Relaciones

- **FlowConfigLoader** → Usado por FlowOrchestrator
- **SchemaLoader** → Usado por ReaderAgent
- **TemplateLoader** → Usado por ArtifactGeneratorAgent
- **SourceResolver** → Usado por FlowOrchestrator

---

## 📍 Ubicación

`src/engines/`
- `FlowConfigLoader.ts`
- `SchemaLoader.ts`
- `TemplateLoader.ts`
- `SourceResolver.ts`
- `index.ts` (exports)
