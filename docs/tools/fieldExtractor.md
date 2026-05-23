# FieldExtractorTool

## 📋 Descripción

Herramienta que utiliza **IBM WatsonX (LLM)** para extraer inteligentemente valores de campos desde múltiples fuentes de datos. Es el cerebro de la extracción, capaz de cruzar referencias, inferir valores y manejar estructuras complejas.

---

## 🎯 Propósito

- Invocar IBM WatsonX LLM con prompts externos configurables
- Extraer valores de campos desde build.json, release.json y archivos del repo
- Cruzar referencias entre fuentes
- Inferir valores no explícitos usando contexto
- Manejar schemas anidados (objetos complejos)
- Proporcionar recuperación robusta de JSON mal formado
- Usar **PromptLoader** para cargar prompts desde `specs/prompts/`

---

## 📥 Input

```typescript
interface FieldExtractionInput {
  schema: any;                    // Schema con definiciones de campos
  sources: FieldExtractionSource[];
  sourceHints?: any;              // Hints de filtrado (opcional)
  apiKey: string;                 // WatsonX API key
  model?: string;                 // Modelo LLM (default: granite-3-3-8b-instruct)
  projectId?: string;             // WatsonX project ID
  baseUrl?: string;               // WatsonX API URL
}

interface FieldExtractionSource {
  name: string;
  data: any;
  description?: string;
}
```

---

## 📤 Output

```typescript
interface FieldExtractionOutput {
  success: boolean;
  extractedFields?: ExtractedField[];
  error?: string;
}

interface ExtractedField {
  fieldName: string;
  value: any;                     // string | number | array | object
  source: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}
```

---

## 🔄 Flujo de Ejecución

```
1. Construir prompt usando PromptLoader
   └─ Cargar prompt-config.json desde specs/prompts/
   └─ Ensamblar fragmentos de prompt (system-role, rules, examples, etc.)
   └─ Reemplazar variables: {{schema}}, {{sources}}
   └─ Instrucciones explícitas sobre enums y valores exactos

2. Crear modelo WatsonX
   └─ Configurar con API key, project ID
   └─ Modelo: ibm/granite-3-3-8b-instruct

3. Invocar LLM
   └─ Enviar prompt ensamblado
   └─ Recibir respuesta JSON

4. Parsear respuesta
   └─ Estrategia 1: Parse JSON completo
   └─ Estrategia 2: Extraer array [...] ignorando texto extra
   └─ Estrategia 3: Recuperación con regex (si hay errores)

5. Retornar extractedFields
```

---

## 🤖 Prompt Estratégico - Sistema Externo

Los prompts ahora se cargan desde **`specs/prompts/`** usando **PromptLoader**.

### Estructura de Prompts

```
specs/prompts/
├── prompt-config.json              # Configuración central
└── fragments/
    └── field-extraction/
        ├── system-role.txt         # Rol del sistema
        ├── task-instructions.txt   # Instrucciones de tarea
        ├── important-rules.txt     # Reglas críticas (enums, etc.)
        ├── output-format.txt       # Formato de respuesta
        ├── examples.txt            # Ejemplos correctos/incorrectos
        └── nested-handling.txt     # Manejo de objetos/arrays
```

### 1. Schema Pasado al LLM

```json
{
  "serviceName": {
    "type": "string",
    "description": "Nombre del servicio",
    "required": true,
    "examples": ["PaymentService", "UserService"]
  },
  "consumerInterface": {
    "type": "array",
    "enum": ["MQ_Cola", "URL_Channel"],
    "enumDescriptions": {
      "MQ_Cola": "Consumo mediante cola IBM MQ",
      "URL_Channel": "Consumo mediante URL/canal HTTP"
    }
  }
}
```

### 2. Fuentes de Datos

```
### Source: build.json
Data Preview:
{
  "serviceName": "MyService",
  "pipeline": { ... }
}

### Source: release.json
Data Preview:
{
  "APPLICATION_NAME": "MyService",
  ...
}

### Source: repository
Files: [
  { path: "config/app.properties", content: "..." }
]
```

### 3. Instrucciones Clave (desde prompts externos)

- **Enums**: Usar valor EXACTO del array "enum", NO las descripciones
  - ✅ Correcto: `"MQ_Cola"` (valor del enum)
  - ❌ Incorrecto: `"cola MQ"` (texto descriptivo)
- **Schemas anidados**: Retornar objeto completo
- **Cross-referencing**: Cruzar referencias entre fuentes
- **Inferencia**: Inferir valores desde contexto cuando sea necesario

---

## 🛡️ Recuperación Robusta de JSON

### Problema:
El LLM a veces devuelve JSON con errores de sintaxis:
```json
[
  { "fieldName": "x", "value": "y" },
  { "fieldName": "z", "<statusCode>...</statusCode>", }  ← Error
]
```

### Solución - 3 Estrategias:

**Estrategia 1**: Parse completo
```typescript
JSON.parse(response)
```

**Estrategia 2**: Extraer array
```typescript
const start = response.indexOf('[');
const end = response.lastIndexOf(']');
const json = response.substring(start, end + 1);
```

**Estrategia 3**: Recuperación con regex
```typescript
// Extrae objetos individuales válidos
const pattern = /\{\s*"fieldName"\s*:\s*"([^"]+)"\s*,[\s\S]*?\}/g;
// Parsea cada objeto por separado
// Retorna solo los válidos
```

**Resultado**: En vez de 0 campos, recupera 8-9 de 10.

---

## 💡 Ejemplo de Uso

```typescript
const extractor = new FieldExtractorTool();

const result = await extractor.run({
  schema: {
    serviceName: { type: "string", required: true },
    timeout: { type: "number", required: true },
    consumerInterface: {
      type: "array",
      enum: ["MQ_Cola", "URL_Channel"]
    }
  },
  sources: [
    {
      name: "build.json",
      data: { serviceName: "MyService", timeout: 30000 }
    },
    {
      name: "release.json",
      data: { APPLICATION_NAME: "MyService" }
    }
  ],
  sourceHints: {
    fileExtensions: [".properties", ".xml"]
  },
  apiKey: process.env.WATSONX_API_KEY,
  projectId: process.env.WATSONX_PROJECT_ID
});

console.log(result.extractedFields);
// [
//   {
//     fieldName: "serviceName",
//     value: "MyService",
//     source: "build.json",
//     confidence: "high",
//     reasoning: "Directly stated in 'serviceName' field"
//   },
//   {
//     fieldName: "consumerInterface",
//     value: ["MQ_Cola"],  // ← Usa valor exacto del enum, no "cola MQ"
//     source: "repository",
//     confidence: "high",
//     reasoning: "Found 'cola MQ' mentioned in README (maps to MQ_Cola enum)"
//   }
// ]
```

---

## 🧠 Capacidades del LLM

- ✅ **Cross-referencing**: `serviceName` en build vs `APPLICATION_NAME` en release
- ✅ **Inferencia**: Tipo de mensajería desde configuración MQ
- ✅ **Contexto semántico**: No solo matches exactos
- ✅ **Objetos anidados**: Request con `type` y `messageRequest`
- ✅ **Confianza**: high/medium/low según claridad
- ✅ **Explicación**: Reasoning para cada campo

---

## 📝 Logging

```
[FieldExtractor] Creating WatsonX model...
  Model: ibm/granite-3-3-8b-instruct
  API Key present: true
  Project ID present: true
[FieldExtractor] Calling WatsonX API...
[WatsonX Event] start
[WatsonX Event] newToken
[WatsonX Event] success
[WatsonX Event] finish
[FieldExtractor] Response received successfully
```

**Con recuperación**:
```
Failed to parse extracted array, attempting recovery...
✓ Recovered 9 fields from malformed JSON
```

---

## 🔗 Usado Por

- **AnalyzerAgent**

---

## 📍 Ubicación

`src/tools/fieldExtractor.ts`
