# JsonParserTool

## 📋 Descripción

Herramienta simple que **parsea strings JSON y valida su estructura**. Retorna el objeto parseado junto con metadata útil (tipo, keys).

---

## 🎯 Propósito

- Parsear strings JSON de forma segura
- Validar que el JSON sea válido
- Determinar tipo de dato (object, array, etc.)
- Extraer keys si es objeto
- Manejo robusto de errores de sintaxis

---

## 📥 Input

```typescript
interface JsonParserInput {
  jsonString: string;         // String JSON a parsear
}
```

---

## 📤 Output

```typescript
interface JsonParserOutput {
  success: boolean;
  data?: any;                 // Objeto parseado
  error?: string;             // Error de parseo
  type?: string;              // "object" | "array" | "string" | "number" | etc.
  keys?: string[];            // Keys del objeto (si type === "object")
}
```

---

## 🔄 Flujo de Ejecución

```
1. Recibir jsonString

2. Validar no vacío
   └─ Si empty → error inmediato

3. Trim whitespace
   └─ jsonString.trim()

4. Parsear JSON
   └─ JSON.parse(trimmed)

5. Determinar tipo
   └─ Array.isArray() → "array"
   └─ Sino → typeof data

6. Extraer keys (si es objeto)
   └─ Object.keys(data)

7. Retornar resultado
```

---

## 💡 Ejemplo de Uso

### Objeto Válido

```typescript
const parser = new JsonParserTool();

const result = await parser.run({
  jsonString: '{"name": "Lucía", "age": 30}'
});

console.log(result);

// Output:
// {
//   success: true,
//   data: { name: "Lucía", age: 30 },
//   type: "object",
//   keys: ["name", "age"]
// }
```

### Array Válido

```typescript
const result = await parser.run({
  jsonString: '["apple", "banana", "orange"]'
});

console.log(result);

// Output:
// {
//   success: true,
//   data: ["apple", "banana", "orange"],
//   type: "array",
//   keys: undefined          // Arrays no tienen keys
// }
```

### JSON Inválido

```typescript
const result = await parser.run({
  jsonString: '{"name": "Lucía", "age": 30'  // ← Falta }
});

console.log(result);

// Output:
// {
//   success: false,
//   error: "Unexpected end of JSON input"
// }
```

### String Vacío

```typescript
const result = await parser.run({
  jsonString: ""
});

console.log(result);

// Output:
// {
//   success: false,
//   error: "Empty JSON string provided"
// }
```

---

## 🧪 Casos de Prueba

### Primitivos JSON

```typescript
// Number
await parser.run({ jsonString: "42" });
// { success: true, data: 42, type: "number" }

// String
await parser.run({ jsonString: '"hello"' });
// { success: true, data: "hello", type: "string" }

// Boolean
await parser.run({ jsonString: "true" });
// { success: true, data: true, type: "boolean" }

// Null
await parser.run({ jsonString: "null" });
// { success: true, data: null, type: "object" }  ← typeof null === "object"
```

### Objetos Anidados

```typescript
const result = await parser.run({
  jsonString: JSON.stringify({
    user: {
      name: "Carlos",
      metadata: {
        role: "admin"
      }
    }
  })
});

// {
//   success: true,
//   data: { user: { name: "Carlos", metadata: { role: "admin" } } },
//   type: "object",
//   keys: ["user"]
// }
```

### Arrays de Objetos

```typescript
const result = await parser.run({
  jsonString: '[{"id": 1}, {"id": 2}]'
});

// {
//   success: true,
//   data: [{ id: 1 }, { id: 2 }],
//   type: "array",
//   keys: undefined
// }
```

---

## 🛡️ Manejo de Errores

### Errores de Sintaxis

```typescript
// Coma trailing
await parser.run({ jsonString: '{"name": "Ana",}' });
// Error: "Unexpected token } in JSON at position 15"

// Comillas simples
await parser.run({ jsonString: "{'name': 'Ana'}" });
// Error: "Unexpected token ' in JSON at position 1"

// Comentarios (no permitidos en JSON)
await parser.run({ jsonString: '{"name": "Ana" /* comment */}' });
// Error: "Unexpected token / in JSON at position 15"
```

### Whitespace

```typescript
// Espacios, tabs, newlines → trimmed
const result = await parser.run({
  jsonString: '\n  \t  {"name": "Ana"}  \n  '
});

// Success: true (whitespace ignorado)
```

---

## 🔧 Uso Interno

### Validación de Respuestas LLM

```typescript
// En FieldExtractorTool:
const llmResponse = await model.generate(...);

const parseResult = await jsonParser.run({
  jsonString: llmResponse
});

if (!parseResult.success) {
  console.error("LLM returned invalid JSON:", parseResult.error);
  // Intentar recovery strategies...
}
```

### Lectura de Archivos de Configuración

```typescript
const fileContent = await fileReader.run({ filePath: "config.json" });

if (fileContent.success) {
  const parsed = await jsonParser.run({
    jsonString: fileContent.content!
  });

  if (parsed.success) {
    const config = parsed.data;
    // Usar configuración...
  }
}
```

---

## 📊 Type Detection

### Implementación

```typescript
const data = JSON.parse(trimmed);
const type = Array.isArray(data) ? "array" : typeof data;
```

### Tipos Posibles

- `"object"` - Objetos JSON (también `null`)
- `"array"` - Arrays
- `"string"` - Strings
- `"number"` - Numbers
- `"boolean"` - Booleans

### Keys Extraction

```typescript
const keys = type === "object" && data !== null
  ? Object.keys(data)
  : undefined;
```

**Nota**: `null` tiene `type: "object"` pero `keys: undefined` por la validación `data !== null`.

---

## 🎯 Ventajas

- ✅ **Simple y directo**: Una responsabilidad clara
- ✅ **Type-safe**: Retorna tipo detectado
- ✅ **Metadata útil**: Keys para introspección
- ✅ **Error handling**: Mensajes descriptivos
- ✅ **Whitespace tolerant**: Trim automático

---

## ⚠️ Limitaciones

- No valida schemas (usar Zod para eso)
- No soporta JSON5 (comentarios, trailing commas)
- No soporta BigInt nativamente
- No soporta streaming (solo strings completos)
- `typeof null === "object"` (limitación de JavaScript)

---

## 🔗 Usado Por

- Potencialmente por cualquier agente/tool que necesite parsear JSON
- No usado directamente en el flujo principal (WriterAgent usa `JSON.parse` directo)
- Útil para validación de inputs externos

---

## 📍 Ubicación

`src/tools/jsonParser.ts`
