# Types Documentation

Esta carpeta contiene la documentación de todos los tipos e interfaces TypeScript/Zod utilizados en el proyecto.

---

## 📂 Archivos de Tipos

### FlowConfig.ts
Define estructuras de configuración para flujos, fuentes y outputs.

### SchemaTypes.ts
Define estructuras para schemas de dominio con validación Zod.

### TemplateTypes.ts
Define estructuras para configuración de templates y artefactos generados.

---

## 🔧 FlowConfig Types

### SourceHints

**Propósito**: Metadata para filtrar archivos del repositorio de forma inteligente.

```typescript
interface SourceHints {
  description: string;                     // Descripción del tipo de archivos buscados
  fileExtensions: string[];                // [".properties", ".xml"]
  directories?: string[];                  // ["config", "resources"]
  patterns?: string[];                     // ["application", "database"]
  priority: ("build" | "release" | "repo")[]; // Orden de preferencia
}
```

**Ejemplo**:
```json
{
  "description": "Configuration files for service metadata",
  "fileExtensions": [".properties", ".xml"],
  "directories": ["config", "src/main/resources"],
  "patterns": ["application", "service"],
  "priority": ["build", "release", "repo"]
}
```

**Usado en**:
- Schemas de dominio (define qué archivos buscar)
- ReaderAgent (filtra archivos del repo)

---

### Sources

**Propósito**: Paths a archivos fuente de datos.

```typescript
interface Sources {
  build?: string;      // Path relativo a build.json
  release?: string;    // Path relativo a release.json
  repo?: string;       // Path relativo al repositorio
}
```

**Ejemplo**:
```json
{
  "build": "data/sources/build.json",
  "release": "data/sources/release.json",
  "repo": "data/repos/my-service"
}
```

**ResolvedSources**: Versión con paths absolutos.

```typescript
interface ResolvedSources {
  build?: string;      // Path absoluto a build.json
  release?: string;    // Path absoluto a release.json
  repo?: string;       // Path absoluto al repo
}
```

---

### OutputConfig

**Propósito**: Configuración de outputs de un flujo.

```typescript
interface OutputConfig {
  intermediate: string;  // Path al JSON intermedio
  artifacts: string;     // Directorio de artefactos generados
}
```

**Ejemplo**:
```json
{
  "intermediate": "output/intermediate/{flowName}.json",
  "artifacts": "output/artifacts/{flowName}/"
}
```

**Variables soportadas**: `{flowName}` se reemplaza con el nombre del flujo.

---

### FlowDefinition

**Propósito**: Definición completa de un flujo individual.

```typescript
interface FlowDefinition {
  description?: string;     // Descripción del flujo
  enabled: boolean;         // Si está habilitado (default: true)
  schema: string;           // Path al schema JSON
  templates: string[];      // Nombres de templates a usar
  sources: Sources;         // Fuentes de datos
  output: OutputConfig;     // Configuración de output
}
```

**Ejemplo**:
```json
{
  "description": "Extract service metadata and generate artifacts",
  "enabled": true,
  "schema": "specs/schemas/service.json",
  "templates": ["SoapRequest", "KarateConfig"],
  "sources": {
    "build": "data/sources/build.json",
    "release": "data/sources/release.json",
    "repo": "data/repos/my-service"
  },
  "output": {
    "intermediate": "output/intermediate/{flowName}.json",
    "artifacts": "output/artifacts/{flowName}/"
  }
}
```

---

### ResolvedFlowDefinition

**Propósito**: FlowDefinition con todos los paths resueltos a absolutos.

```typescript
interface ResolvedFlowDefinition extends Omit<FlowDefinition, "sources"> {
  name: string;                    // Nombre del flujo
  sources: ResolvedSources;        // Paths absolutos
  resolvedSchemaPath: string;      // Path absoluto al schema
  resolvedOutputPaths: {
    intermediate: string;          // Path absoluto al JSON intermedio
    artifacts: string;             // Path absoluto a directorio artifacts
  };
}
```

**Generado por**: `FlowConfigLoader.resolveFlowPaths()`

**Usado por**: `FlowExecutor.execute()`

---

### FlowConfig

**Propósito**: Configuración completa del archivo `flow-configuration.json`.

```typescript
interface FlowConfig {
  $schema?: string;      // JSON Schema reference
  version?: string;      // Versión de configuración
  description?: string;  // Descripción general
  flows: Record<string, FlowDefinition>;  // Flujos indexados por nombre
}
```

**Ejemplo**:
```json
{
  "$schema": "./flow-configuration.schema.json",
  "version": "1.0.0",
  "description": "Bee Agent for Scaffold - Flow Configuration",
  "flows": {
    "serviceMetadata": { ... },
    "bddScenarios": { ... }
  }
}
```

---

## 📊 SchemaTypes

### DomainField

**Propósito**: Definición de un campo en el schema de dominio.

```typescript
interface DomainField {
  value: any;                          // Valor del campo (placeholder)
  type: string;                        // "string" | "number" | "array" | "object"
  description: string;                 // Descripción del campo
  required?: boolean;                  // Si es obligatorio
  validation?: Record<string, any>;    // Reglas de validación
  examples?: any[];                    // Ejemplos de valores
  enum?: string[];                     // Valores permitidos
  enumDescriptions?: Record<string, string>; // Descripciones de enum
  schema?: Record<string, any>;        // Schema anidado (para objects/arrays)
}
```

**Ejemplo - Campo Simple**:
```json
{
  "serviceName": {
    "value": "",
    "type": "string",
    "description": "Nombre del servicio",
    "required": true,
    "examples": ["PaymentService", "UserService"]
  }
}
```

**Ejemplo - Campo con Enum**:
```json
{
  "messagingType": {
    "value": "",
    "type": "string",
    "description": "Tipo de mensajería",
    "required": true,
    "enum": ["XML-IAST", "IAST-XML", "XML-XML"],
    "enumDescriptions": {
      "XML-IAST": "SOAP to REST conversion",
      "IAST-XML": "REST to SOAP conversion",
      "XML-XML": "SOAP to SOAP passthrough"
    }
  }
}
```

**Ejemplo - Campo con Schema Anidado**:
```json
{
  "request": {
    "value": {},
    "type": "object",
    "description": "Request configuration",
    "schema": {
      "type": {
        "value": [],
        "type": "array",
        "description": "Response types expected"
      },
      "messageRequest": {
        "value": "",
        "type": "string",
        "description": "SOAP envelope"
      }
    }
  }
}
```

---

### SchemaWithHints

**Propósito**: Schema completo con sourceHints y datos de dominio.

```typescript
interface SchemaWithHints {
  sourceHints: SourceHints;          // Metadata de filtrado
  data?: Record<string, any>;        // Campos de dominio
  scenarios?: Record<string, any>;   // Escenarios BDD (opcional)
}
```

**Ejemplo**:
```json
{
  "sourceHints": {
    "description": "Service metadata files",
    "fileExtensions": [".properties", ".xml"],
    "priority": ["build", "release", "repo"]
  },
  "data": {
    "serviceName": { ... },
    "timeout": { ... }
  }
}
```

---

### LoadedSchema

**Propósito**: Schema cargado con metadata adicional.

```typescript
interface LoadedSchema {
  sourceHints: SourceHints;          // Hints de filtrado
  data: Record<string, any>;         // Campos de dominio
  raw: SchemaWithHints;              // Schema completo sin procesar
  path: string;                      // Path del archivo schema
}
```

**Generado por**: `SchemaLoader.load()`

**Usado por**: `ReaderAgent` (sourceHints), `AnalyzerAgent` (data)

---

## 🎨 TemplateTypes

### FieldMappingConfig

**Propósito**: Configuración de mapeo de campo compleja.

```typescript
interface FieldMappingConfig {
  path: string;                      // Path al campo en outputJson
  required?: boolean;                // Validar presencia
  transform?: "upper" | "lower" | "trim"; // Transformación
  default?: any;                     // Valor por defecto
}
```

**Ejemplo**:
```json
{
  "serviceName": {
    "path": "data.serviceName.value",
    "required": true
  },
  "timeout": {
    "path": "data.timeout.value",
    "default": 30000
  },
  "env": {
    "path": "data.environment.value",
    "transform": "lower"
  }
}
```

---

### TemplateConfig

**Propósito**: Configuración completa de un template (config.json).

```typescript
interface TemplateConfig {
  name: string;                      // Nombre del template
  description?: string;              // Descripción
  outputFileName: string;            // Nombre de archivo (soporta {vars})
  enabled: boolean;                  // Si está habilitado (default: true)
  mapping: Record<string, string | FieldMappingConfig>; // Mapeo de campos
}
```

**Ejemplo**:
```json
{
  "name": "SOAP Request Generator",
  "description": "Generates SOAP request XML files",
  "outputFileName": "soap-request-{serviceName}.xml",
  "enabled": true,
  "mapping": {
    "serviceName": "data.serviceName.value",
    "systemId": {
      "path": "data.systemId.value",
      "default": "DEFAULT_SYSTEM"
    }
  }
}
```

---

### LoadedTemplate

**Propósito**: Template cargado con contenido y configuración.

```typescript
interface LoadedTemplate {
  name: string;                      // Nombre del template
  config: TemplateConfig;            // Configuración (config.json)
  templateContent: string;           // Contenido del template.bbt
  templatePath: string;              // Path al template.bbt
  configPath: string;                // Path al config.json
}
```

**Generado por**: `TemplateLoader.load()`

**Usado por**: `ArtifactGeneratorAgent`

---

### GeneratedArtifact

**Propósito**: Artefacto generado por ArtifactGeneratorAgent.

```typescript
interface GeneratedArtifact {
  templateName: string;              // Nombre del template usado
  fileName: string;                  // Nombre del archivo generado
  filePath: string;                  // Path completo al archivo
  content: string;                   // Contenido del artefacto
  size: number;                      // Tamaño en bytes
}
```

**Ejemplo**:
```typescript
{
  templateName: "SoapRequest",
  fileName: "soap-request-MyService.xml",
  filePath: "/output/artifacts/soap-request-MyService.xml",
  content: "<soapenv:Envelope>...</soapenv:Envelope>",
  size: 1024
}
```

---

### GenerationResult

**Propósito**: Resultado de generación de artefactos.

```typescript
interface GenerationResult {
  success: boolean;                  // Si la generación fue exitosa
  artifacts: GeneratedArtifact[];    // Artefactos generados
  errors?: string[];                 // Errores (si los hay)
}
```

---

## 🔍 Validación con Zod

La mayoría de tipos tienen schemas Zod correspondientes para validación en runtime:

```typescript
// Schema Zod
export const FlowDefinitionSchema = z.object({
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  schema: z.string(),
  templates: z.array(z.string()),
  sources: SourcesSchema,
  output: OutputConfigSchema,
});

// Type inferido
export type FlowDefinition = z.infer<typeof FlowDefinitionSchema>;
```

**Ventajas**:
- ✅ Validación en runtime
- ✅ Type safety automática
- ✅ Mensajes de error descriptivos
- ✅ Valores por defecto

---

## 📍 Ubicación

- `src/types/FlowConfig.ts` - Tipos de configuración de flujos
- `src/types/SchemaTypes.ts` - Tipos de schemas de dominio
- `src/types/TemplateTypes.ts` - Tipos de templates y artefactos
- `src/types/index.ts` - Exports centralizados
