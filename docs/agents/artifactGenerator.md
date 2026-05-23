# ArtifactGeneratorAgent

## 📋 Descripción General

El **ArtifactGeneratorAgent** es responsable de **generar artefactos** (archivos de código, configuración, pruebas) a partir del JSON intermedio usando **templates Mustache**. Implementa el patrón **1 Schema → N Templates**: un mismo JSON puede generar múltiples artefactos.

---

## 🎯 Propósito

- Generar múltiples artefactos desde un JSON intermedio
- Cargar y procesar templates Handlebars/Mustache
- Aplicar mapping de configuración (config.json)
- Soportar nombres de archivo dinámicos con variables
- Usar PromptTemplate de Bee Framework (sin dependencias externas)

---

## 🔧 Tools Utilizados

| Tool | Uso |
|------|-----|
| **TemplateLoader** (engine) | Carga templates desde `specs/templates/` |
| **TemplateRendererTool** | Renderiza templates Mustache con PromptTemplate |

---

## 📥 Input

```typescript
interface ArtifactGeneratorAgentInput {
  outputJson: any;                      // JSON intermedio (limpio)
  flowDefinition: ResolvedFlowDefinition;
}
```

**Campos clave**:
- `outputJson`: Datos limpios del WriterAgent
- `flowDefinition.templates`: Array de nombres de templates a usar
- `flowDefinition.resolvedOutputPaths.artifacts`: Directorio de salida

---

## 📤 Output

```typescript
interface GenerationResult {
  success: boolean;
  artifacts: Array<{
    templateName: string;
    fileName: string;
    filePath: string;
    size: number;
  }>;
  error?: string;
}
```

---

## 🔄 Flujo de Ejecución

```
1. Recibir outputJson y flowDefinition

2. Para cada template en flowDefinition.templates:

   a. Cargar template con TemplateLoader
      └─ Lee config.json (mapping, outputFileName)
      └─ Lee template.bbt (Mustache template)

   b. Aplicar mapping
      └─ Extraer campos según paths definidos
      └─ Aplicar valores por defecto
      └─ Ejemplo: "data.serviceName.value" → "MyService"

   c. Resolver nombre de archivo dinámico
      └─ "soap-request-{serviceName}.xml" → "soap-request-MyService.xml"

   d. Renderizar template con TemplateRendererTool
      └─ Usa PromptTemplate (Bee Framework)
      └─ Aplica funciones custom (timestamp, uuid)

   e. Escribir archivo a disco
      └─ Path: artifacts/soap-request-MyService.xml

3. Retornar lista de artefactos generados
```

---

## 🎨 Estructura de Templates

Cada template tiene su propia carpeta en `specs/templates/`:

```
specs/templates/SoapRequest/
├── config.json       # Configuración y mapping
└── template.bbt      # Template Mustache
```

### config.json

```json
{
  "name": "SOAP Request Generator",
  "outputFileName": "soap-request-{serviceName}.xml",
  "enabled": true,
  "mapping": {
    "serviceName": {
      "path": "data.serviceName.value",
      "required": true
    },
    "timeout": {
      "path": "data.timeout.value",
      "default": 30000
    }
  }
}
```

**Campos**:
- `outputFileName`: Soporta variables `{variableName}`
- `mapping`: Extrae campos del JSON intermedio
- `path`: JSONPath-like al campo en outputJson
- `default`: Valor si no se encuentra

### template.bbt (Mustache)

```xml
<soapenv:Envelope>
  <soapenv:Header>
    <systemId>{{systemId}}</systemId>
    <timestamp>{{timestamp}}</timestamp>
  </soapenv:Header>
  <soapenv:Body>
    <operation>{{serviceName}}</operation>
  </soapenv:Body>
</soapenv:Envelope>
```

**Funciones disponibles**:
- `{{timestamp}}`: Fecha/hora ISO actual (auto-generada)
- `{{uuid}}`: UUID aleatorio (auto-generado)
- `{{#upper}}text{{/upper}}`: Mayúsculas
- `{{#lower}}text{{/lower}}`: Minúsculas

---

## 🏗️ Patrón 1 Schema → N Templates

Un mismo schema puede generar **múltiples artefactos**:

```json
// flow-configuration.json
{
  "flows": {
    "serviceMetadata": {
      "schema": "schemas/service.json",
      "templates": ["SoapRequest", "KarateConfig", "RestClient"],
      ...
    }
  }
}
```

**Resultado**:
- `soap-request-MyService.xml`
- `karate-config-MyService.js`
- `rest-client-MyService.http`

Todos generados desde el mismo JSON intermedio, cada uno con su formato específico.

---

## 💡 Ejemplo de Uso

```typescript
const generator = new ArtifactGeneratorAgent();

const result = await generator.generate({
  outputJson: {
    serviceName: "MyService",
    timeout: 5000,
    systemId: "SYS-001"
  },
  flowDefinition: {
    templates: ["SoapRequest", "KarateConfig"],
    resolvedOutputPaths: {
      artifacts: "/output/artifacts/"
    }
  }
});

console.log(result.artifacts);
// [
//   {
//     templateName: "SoapRequest",
//     fileName: "soap-request-MyService.xml",
//     filePath: "/output/artifacts/soap-request-MyService.xml",
//     size: 1024
//   },
//   {
//     templateName: "KarateConfig",
//     fileName: "karate-config-MyService.js",
//     filePath: "/output/artifacts/karate-config-MyService.js",
//     size: 512
//   }
// ]
```

---

## 🔧 Resolución de Nombres Dinámicos

El método `resolveFileName()` reemplaza variables en el nombre de archivo:

```typescript
// outputFileName: "soap-request-{serviceName}.xml"
// data: { serviceName: "MyService" }
// Resultado: "soap-request-MyService.xml"

// outputFileName: "feature-{serviceName}-{environment}.feature"
// data: { serviceName: "Payment", environment: "prod" }
// Resultado: "feature-Payment-prod.feature"
```

---

## 📝 Logging

```
[OK] Loaded 2 templates
[Processing] SOAP Request Generator
  [✓] Generated: /output/artifacts/soap-request-MyService.xml
[Processing] Karate Config Generator
  [✓] Generated: /output/artifacts/karate-config-MyService.js
```

**En caso de error**:
```
[ERROR] Template 'InvalidTemplate' not found
[ERROR] Failed to render template 'SoapRequest': Missing required field 'serviceName'
```

---

## 🔗 Relaciones

- **Llamado por**: `FlowExecutor` (Fase 4 - final)
- **Recibe de**: `WriterAgent` (JSON intermedio)
- **Usa engines**: `TemplateLoader`
- **Usa tools**: `TemplateRendererTool`
- **Output**: Archivos de artefactos en disco

---

## 📍 Ubicación

`src/agents/artifactGenerator.ts`
