# WriterAgent

## 📋 Descripción General

El **WriterAgent** es responsable de **construir y escribir el JSON intermedio** con los datos extraídos. Toma los campos del AnalyzerAgent, los ensambla según el schema, valida la estructura completa, y escribe un JSON limpio (solo valores, sin metadata).

---

## 🎯 Propósito

- Ensamblar campos extraídos en estructura JSON según schema
- Validar que todos los campos requeridos estén presentes
- Generar JSON limpio (solo valores, sin metadata del schema)
- Escribir archivo JSON intermedio en disco
- Proporcionar feedback claro sobre errores de validación

---

## 🔧 Tools Utilizados

| Tool | Uso |
|------|-----|
| **JsonBuilderTool** | Construye JSON desde schema + extracted fields, valida y escribe archivo |

---

## 📥 Input

```typescript
interface WriterAgentInput {
  schema: any;                          // Schema definition
  extractedFields: ExtractedField[];    // Fields from Analyzer
  flowDefinition: ResolvedFlowDefinition;
}
```

**Campos clave**:
- `schema`: Estructura de datos a generar
- `extractedFields`: Valores extraídos por el Analyzer
- `flowDefinition.resolvedOutputPaths.intermediate`: Path del JSON de salida

---

## 📤 Output

```typescript
interface WriteResult {
  success: boolean;
  outputPath?: string;
  json?: string;
  error?: string;
  validationErrors?: string[];
}
```

**Success case**:
- `success: true`
- `outputPath`: Path al JSON generado
- `json`: Contenido del JSON

**Error case**:
- `success: false`
- `validationErrors`: Lista de errores de validación

---

## 🔄 Flujo de Ejecución

```
1. Recibir schema y extractedFields

2. Invocar JsonBuilderTool
   └─ Construir JSON desde schema
   └─ Mapear extractedFields a estructura
   └─ Validar campos requeridos
   └─ Limpiar metadata (extractCleanValues)

3. Si validación falla
   └─ Retornar error con lista detallada
   └─ Abortar flujo

4. Si validación pasa
   └─ Escribir JSON a disco
   └─ Retornar success con path

5. Retornar WriteResult
```

---

## 🧹 JSON Limpio - extractCleanValues()

El WriterAgent genera un **JSON limpio** removiendo toda la metadata del schema:

### Antes (con metadata):
```json
{
  "serviceName": {
    "value": "MyService",
    "type": "string",
    "description": "Nombre del servicio",
    "required": true,
    "examples": ["PaymentService"]
  },
  "timeout": {
    "value": 30000,
    "type": "number",
    "required": true
  }
}
```

### Después (limpio):
```json
{
  "serviceName": "MyService",
  "timeout": 30000
}
```

**Ventajas**:
- ✅ Más fácil de leer
- ✅ Directo para templates
- ✅ Sin ruido de metadata
- ✅ Reduce tamaño del archivo

---

## 🛡️ Validación

El WriterAgent valida:

1. **Campos requeridos**: Deben tener valor no vacío
2. **Tipos de datos**: Deben coincidir con schema (string, number, array, object)
3. **Enums**: Valores deben estar en lista permitida
4. **Arrays con schema**: Cada elemento validado contra schema
5. **Objetos anidados**: Campos required internos validados

### Ejemplo de errores de validación:

```
Validation errors:
  - Required field 'serviceName' has empty value
  - Required field 'request.schema.messageRequest' has empty value
  - Field 'messagingType' has invalid value 'XML-REST'. Must be one of: XML-IAST, IAST-XML, XML-XML
```

---

## 💡 Ejemplo de Uso

```typescript
const writerAgent = new WriterAgent();

const result = await writerAgent.write({
  schema: {
    serviceName: { value: "", type: "string", required: true },
    timeout: { value: "", type: "number", required: true }
  },
  extractedFields: [
    { fieldName: "serviceName", value: "MyService" },
    { fieldName: "timeout", value: 30000 }
  ],
  flowDefinition: {
    resolvedOutputPaths: {
      intermediate: "/output/service-metadata.json"
    }
  }
});

if (result.success) {
  console.log(`JSON written to: ${result.outputPath}`);
  // Output: JSON written to: /output/service-metadata.json
}
```

---

## 📊 Manejo de Campos Complejos

### Arrays:
```json
{
  "operations": ["getUser", "createUser", "deleteUser"]
}
```

### Objetos con Schema Anidado:
```json
{
  "request": {
    "type": ["success", "businessException"],
    "messageRequest": "<soapenv:Envelope>...</soapenv:Envelope>"
  }
}
```

### Arrays de Objetos:
```json
{
  "scenariosBddModular": [
    {
      "scenery": "testSuccess",
      "request": "messages/success.xml",
      "responseCode": 200
    }
  ]
}
```

---

## 📝 Logging

```
[WriterAgent] Building output JSON...
[Flow] serviceMetadata
[Output] path: /output/service-metadata.json
[Building] Assembling 10 fields into JSON structure...
[OK] JSON built and validated successfully
[Output] written to: /output/service-metadata.json
```

**En caso de error**:
```
[ERROR] Failed to build JSON: Validation failed: Required field 'serviceName' has empty value
Validation errors:
  - Required field 'serviceName' has empty value
  - Required field 'timeout' has empty value
```

---

## 🔗 Relaciones

- **Llamado por**: `FlowExecutor` (Fase 3)
- **Recibe de**: `AnalyzerAgent`
- **Llama a**: `ArtifactGeneratorAgent` (siguiente fase)
- **Usa tools**: `JsonBuilderTool`

---

## 📍 Ubicación

`src/agents/writer.ts`
