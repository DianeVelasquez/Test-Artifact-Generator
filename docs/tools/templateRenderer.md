# TemplateRendererTool

## 📋 Descripción

Herramienta que renderiza templates **Mustache** usando **PromptTemplate** de Bee Framework. Reemplazó a Handlebars para eliminar dependencias externas y aprovechar integración nativa con Zod.

---

## 🎯 Propósito

- Renderizar templates Mustache con datos
- Usar PromptTemplate de Bee Framework (sin dependencias externas)
- Validación automática con Zod schemas
- Proporcionar funciones custom (timestamp, uuid, upper, lower)
- Soportar templates desde archivo o contenido directo

---

## 📥 Input

```typescript
interface TemplateRendererInput {
  templatePath?: string;           // Path al archivo template
  templateContent?: string;        // Contenido directo del template
  data: Record<string, any>;       // Datos para el template
  useContent?: boolean;            // Usar templateContent en vez de path
}
```

---

## 📤 Output

```typescript
interface TemplateRendererOutput {
  success: boolean;
  rendered?: string;              // Template renderizado
  error?: string;
}
```

---

## 🔄 Flujo de Ejecución

```
1. Cargar contenido del template
   └─ Desde templateContent (si useContent = true)
   └─ O desde templatePath (leer archivo)

2. Generar schema Zod dinámico
   └─ buildZodSchema(data)
   └─ Inferir tipos: string, number, boolean, array, object
   └─ Agregar campos para timestamp y uuid

3. Enriquecer data con funciones
   └─ timestamp: ISO date actual
   └─ uuid: UUID aleatorio
   └─ (upper y lower como funciones del template)

4. Crear PromptTemplate
   └─ Configurar con schema Zod
   └─ Agregar funciones custom (upper, lower)

5. Renderizar template
   └─ template.render(enrichedData)

6. Retornar resultado
```

---

## 🎨 Sintaxis Mustache

### Variables Simples
```mustache
<name>{{serviceName}}</name>
<timeout>{{timeout}}</timeout>
```

### Arrays - Iteración
```mustache
operations: [
  {{#operations}}'{{.}}',{{/operations}}
]
```

### Condicionales
```mustache
{{#description}}
# Description: {{description}}
{{/description}}
{{^description}}
# No description provided
{{/description}}
```

### Objetos Anidados
```mustache
<request>
  {{#request}}
  <type>{{type}}</type>
  <message>{{messageRequest}}</message>
  {{/request}}
</request>
```

---

## 🔧 Funciones Custom

### timestamp (auto-generado)
```mustache
<timestamp>{{timestamp}}</timestamp>
```
Output:
```xml
<timestamp>2025-11-22T23:55:44.455Z</timestamp>
```

### uuid (auto-generado)
```mustache
<uuid>{{uuid}}</uuid>
```
Output:
```xml
<uuid>709f68b9-23c0-4524-bec0-1ac51ba887a1</uuid>
```

### upper (función lambda)
```mustache
<operation>{{#upper}}{{serviceName}}{{/upper}}</operation>
```
Output:
```xml
<operation>MYSERVICE</operation>
```

### lower (función lambda)
```mustache
<env>{{#lower}}{{environment}}{{/lower}}</env>
```
Output:
```xml
<env>production</env>
```

---

## 💡 Ejemplo de Uso

### Desde archivo
```typescript
const renderer = new TemplateRendererTool();

const result = await renderer.run({
  templatePath: "specs/templates/SoapRequest/template.bbt",
  data: {
    serviceName: "MyService",
    systemId: "SYS-001",
    operationName: "getUser"
  }
});

console.log(result.rendered);
```

### Desde contenido directo
```typescript
const result = await renderer.run({
  templateContent: "<name>{{serviceName}}</name><timeout>{{timeout}}</timeout>",
  data: {
    serviceName: "TestService",
    timeout: 5000
  },
  useContent: true
});

console.log(result.rendered);
// <name>TestService</name><timeout>5000</timeout>
```

---

## 🏗️ Schema Zod Dinámico

El tool genera automáticamente un schema Zod desde los datos:

```typescript
// Input data:
{
  serviceName: "MyService",
  timeout: 30000,
  operations: ["getUser", "createUser"]
}

// Schema generado:
z.object({
  serviceName: z.string().optional(),
  timeout: z.number().optional(),
  operations: z.array(z.any()).optional(),
  timestamp: z.string().optional(),  // Auto-agregado
  uuid: z.string().optional()        // Auto-agregado
})
```

---

## 📊 Migración de Handlebars

### Antes (Handlebars)
```typescript
import Handlebars from "handlebars";

Handlebars.registerHelper("timestamp", () => new Date().toISOString());
const template = Handlebars.compile(content);
const rendered = template(data);
```

### Después (PromptTemplate)
```typescript
import { PromptTemplate } from "beeai-framework/template";

const template = new PromptTemplate({
  schema: buildZodSchema(data),
  template: content,
  functions: getCustomFunctions()
});
const rendered = template.render(enrichedData);
```

**Ventajas**:
- ✅ Sin dependencias externas
- ✅ Validación Zod automática
- ✅ Integración nativa con Bee
- ✅ Type-safe

---

## 🔗 Usado Por

- **ArtifactGeneratorAgent**

---

## 📍 Ubicación

`src/tools/templateRenderer.ts`
