# AnalyzerAgent

## 📋 Descripción General

El **AnalyzerAgent** es responsable del **análisis inteligente** de los datos recolectados por el Reader. Utiliza **IBM WatsonX (LLM)** para extraer valores de campos desde fuentes múltiples, cruzando referencias y realizando inferencias semánticas.

---

## 🎯 Propósito

- Analizar datos de build.json, release.json y repositorio
- Extraer valores para cada campo definido en el schema
- Asignar niveles de confianza (high/medium/low)
- Proporcionar razonamiento para cada extracción
- Manejar campos con schemas anidados (objetos complejos)

---

## 🔧 Tools Utilizados

| Tool | Uso |
|------|-----|
| **FieldExtractorTool** | Invoca WatsonX LLM para extracción inteligente de campos |

---

## 📥 Input

```typescript
interface AnalyzerAgentInput {
  sourceData: SourceData;
}
```

**Recibe del ReaderAgent**:
- `schema`: Definición de campos a extraer
- `sourceHints`: Hints de filtrado
- `build`, `release`: Datos JSON
- `repoFiles`: Archivos filtrados del repositorio

---

## 📤 Output

```typescript
interface AnalysisResult {
  extractedFields: ExtractedField[];
}

interface ExtractedField {
  fieldName: string;
  value: any;                    // string | number | array | object
  source: string;                // "build.json", "release.json", "repository"
  confidence: "high" | "medium" | "low";
  reasoning: string;             // Explicación del LLM
}
```

---

## 🔄 Flujo de Ejecución

```
1. Recibir SourceData del Reader

2. Preparar datos para LLM
   └─ Convertir schema a JSON
   └─ Preparar fuentes (build, release, repoFiles)
   └─ Incluir sourceHints como contexto

3. Invocar FieldExtractorTool
   └─ Envía prompt a WatsonX
   └─ LLM analiza datos y extrae campos
   └─ Retorna array de ExtractedField

4. Procesar respuesta del LLM
   └─ Validar JSON
   └─ Recuperar campos parciales si hay errores
   └─ Mapear a ExtractedField[]

5. Retornar AnalysisResult
```

---

## 🤖 Prompt Estratégico al LLM

El AnalyzerAgent envía un prompt estructurado que incluye:

1. **Schema completo**: Qué campos extraer, tipos, descripciones
2. **SourceHints**: Qué tipo de datos buscar
3. **Múltiples fuentes**: build.json, release.json, archivos del repo
4. **Instrucciones especiales**:
   - Cómo manejar enums
   - Cómo inferir valores
   - Cómo manejar schemas anidados
   - Formato de salida JSON

---

## 🧠 Capacidades del LLM

El LLM (WatsonX Granite) puede:

- ✅ **Cruzar referencias** entre fuentes (ej: `serviceName` en build vs `APPLICATION_NAME` en release)
- ✅ **Inferir valores** no explícitos (ej: tipo de mensajería desde configuraciones MQ)
- ✅ **Entender contexto** semántico (no solo coincidencias exactas)
- ✅ **Asignar confianza** basado en claridad de evidencia
- ✅ **Manejar objetos complejos** con schemas anidados
- ✅ **Explicar razonamiento** para cada extracción

---

## 💡 Ejemplo de Uso

```typescript
const analyzerAgent = new AnalyzerAgent(llm);

const result = await analyzerAgent.analyze({
  sourceData: {
    schema: { /* schema con campos */ },
    sourceHints: { fileExtensions: [".xml"], ... },
    build: { serviceName: "MyService", ... },
    release: { APPLICATION_NAME: "MyService", ... },
    repoFiles: [
      { path: "config/app.properties", content: "..." }
    ]
  }
});

// Resultado:
result.extractedFields[0] = {
  fieldName: "serviceName",
  value: "MyService",
  source: "build.json",
  confidence: "high",
  reasoning: "Directly stated in 'serviceName' field of build.json"
}
```

---

## 📊 Ejemplo de Output

```json
[
  {
    "fieldName": "serviceName",
    "value": "envioalertasynotificaciones",
    "source": "release.json",
    "confidence": "high",
    "reasoning": "Value specified in 'APPLICATION_NAME' field"
  },
  {
    "fieldName": "messagingType",
    "value": "XML-IAST",
    "source": "Inferred from MQ configuration",
    "confidence": "medium",
    "reasoning": "MQ endpoints and IAST variables suggest XML-IAST transformation"
  },
  {
    "fieldName": "request",
    "value": {
      "type": ["success", "businessException"],
      "messageRequest": "<soapenv:Envelope>...</soapenv:Envelope>"
    },
    "source": "Inferred from typical SOAP patterns",
    "confidence": "medium",
    "reasoning": "SOAP service structure implies standard request format"
  }
]
```

---

## 🛡️ Manejo de Errores

El AnalyzerAgent incluye **recuperación robusta de JSON**:

1. **Estrategia 1**: Parse JSON completo
2. **Estrategia 2**: Extraer array `[...]` ignorando texto extra
3. **Estrategia 3**: **Recuperación**: Extraer objetos individuales válidos con regex

Si el LLM devuelve JSON parcialmente inválido, el sistema recupera los campos válidos en lugar de fallar completamente.

---

## 📝 Logging

```
[AnalyzerAgent] Starting intelligent analysis...
[Flow] serviceMetadata - Metadata de servicios SOAP/REST
[Schema] fields to extract: serviceName, messagingType, consumer, ...
[Sources] Using 3 data sources
[WatsonX] Invoking AI to intelligently extract fields...
[FieldExtractor] Creating WatsonX model...
  Model: ibm/granite-3-3-8b-instruct
[FieldExtractor] Calling WatsonX API...
[WatsonX Event] success
[OK] Field extraction completed successfully
[Extracted] 10 fields
```

---

## 🔗 Relaciones

- **Llamado por**: `FlowExecutor` (Fase 2)
- **Recibe de**: `ReaderAgent`
- **Llama a**: `WriterAgent` (siguiente fase)
- **Usa tools**: `FieldExtractorTool`
- **Usa LLM**: IBM WatsonX Granite

---

## 📍 Ubicación

`src/agents/analyzer.ts`
