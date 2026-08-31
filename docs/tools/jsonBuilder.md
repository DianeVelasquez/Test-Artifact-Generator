# JsonBuilderTool

## 📋 Descripción

Herramienta que **construye, valida y escribe** archivos JSON siguiendo un schema. Toma campos extraídos, los ensambla en la estructura correcta, valida que cumplan requisitos, y genera un JSON limpio (solo valores).

---

## 🎯 Propósito

- Construir JSON con valores directos desde schema + valores extraídos
- Validar campos requeridos, tipos, enums
- Manejar arrays con schemas (validar cada elemento)
- Manejar objetos anidados (schemas nested)
- Escribir archivo JSON limpio a disco (solo valores, sin metadata)

---

## 📥 Input

```typescript
interface JsonBuilderInput {
  schema: any;                    // Schema definition
  fieldValues: FieldValue[];      // Valores extraídos
  outputPath: string;             // Path de salida
  pretty?: boolean;               // Format JSON (default: true)
}

interface FieldValue {
  fieldName: string;
  value: any;
}
```

---

## 📤 Output

```typescript
interface JsonBuilderOutput {
  success: boolean;
  outputPath?: string;
  json?: string;
  error?: string;
  validationErrors?: string[];
}
```

---

## 🔄 Flujo de Ejecución

```
1. Construir JSON desde schema
   └─ buildJsonFromSchema()
   └─ Para cada campo en schema:
      - Buscar valor en fieldValues
      - Asignar valor directamente (sin wrappers)
      - Manejar schemas anidados
      - Manejar arrays

2. Validar estructura completa
   └─ validateOutput()
   └─ Verificar:
      - Campos requeridos no vacíos
      - Tipos correctos
      - Enums válidos
      - Arrays con elementos válidos

3. Si validación falla
   └─ Retornar error con lista detallada

4. Escribir a disco
   └─ Crear directorio si no existe
   └─ Guardar JSON formateado

5. Retornar resultado
```

---

## 🛡️ Validación

### Campos Requeridos
```typescript
if (fieldDef.required && value === "") {
  errors.push(`Required field '${fieldPath}' has empty value`);
}
```

### Tipos de Datos
```typescript
if (expectedType === "number" && actualType === "string") {
  errors.push(`Field '${fieldPath}' has type 'string' but expected 'number'`);
}
```

### Enums
```typescript
if (!enumValues.includes(value)) {
  errors.push(
    `Field '${fieldPath}' has invalid value '${value}'. ` +
    `Must be one of: ${enumValues.join(", ")}`
  );
}
```

### Arrays con Schema
```typescript
// Valida cada elemento del array contra el schema
for (let i = 0; i < arrayValue.length; i++) {
  validateArrayElement(arrayValue[i], fieldDef.schema, `${fieldPath}[${i}]`);
}
```

---

## 🔧 Manejo de Schemas Anidados

### Caso 1: Objeto con Schema (request, response)

**Schema**:
```json
{
  "request": {
    "type": "object",
    "schema": {
      "type": { "type": "array" },
      "messageRequest": { "type": "string" }
    }
  }
}
```

**fieldValues**:
```typescript
{
  fieldName: "request",
  value: {
    type: ["success", "businessException"],
    messageRequest: "<soapenv:Envelope>...</soapenv:Envelope>"
  }
}
```

**Resultado**:
```json
{
  "request": {
    "type": ["success", "businessException"],
    "messageRequest": "<soapenv:Envelope>...</soapenv:Envelope>"
  }
}
```

### Caso 2: Array con Schema (scenariosBddModular)

**Schema**:
```json
{
  "scenariosBddModular": {
    "type": "array",
    "schema": {
      "scenery": { "type": "string", "required": true },
      "request": { "type": "string", "required": true }
    }
  }
}
```

**fieldValues**:
```typescript
{
  fieldName: "scenariosBddModular",
  value: [
    { scenery: "testSuccess", request: "msg.xml" },
    { scenery: "testError", request: "error.xml" }
  ]
}
```

**Validación**: Cada elemento validado contra schema.

---

## 💡 Ejemplo de Uso

```typescript
const builder = new JsonBuilderTool();

const result = await builder.run({
  schema: {
    serviceName: { type: "string", required: true },
    timeout: { type: "number", required: false }
  },
  fieldValues: [
    { fieldName: "serviceName", value: "MyService" },
    { fieldName: "timeout", value: 30000 }
  ],
  outputPath: "/output/service-metadata.json",
  pretty: true
});

if (result.success) {
  console.log(`JSON written to: ${result.outputPath}`);
}

// Output escrito: {"serviceName": "MyService", "timeout": 30000}
```

---

## 📝 Mensajes de Error

### Campo Requerido Vacío
```
Required field 'serviceName' has empty value
```

### Tipo Incorrecto
```
Field 'timeout' has type 'string' but expected 'number'
```

### Enum Inválido
```
Field 'messagingType' has invalid value 'XML-REST'.
Must be one of: XML-IAST, IAST-XML, XML-XML
```

### Array Element Error
```
Required field 'scenery' is missing in array element at 'scenariosBddModular[0]'
```

---

## 🔗 Usado Por

- **WriterAgent**

---

## 📍 Ubicación

`src/tools/jsonBuilder.ts`
