# FieldMapperTool

## 📋 Descripción

Herramienta que **mapea campos desde outputJson a variables de template** usando configuraciones de mapeo. Soporta paths anidados, transformaciones (upper, lower, trim), valores por defecto y validación de campos requeridos.

---

## 🎯 Propósito

- Extraer valores desde JSON anidado usando paths (e.g., `data.serviceName.value`)
- Aplicar transformaciones a valores (upper, lower, trim)
- Proveer valores por defecto si campo no existe
- Validar que campos requeridos estén presentes
- Generar objeto plano para uso en templates

---

## 📥 Input

```typescript
interface FieldMapperInput {
  outputJson: any;              // JSON intermedio (generado por WriterAgent)
  mapping: FieldMapping;        // Configuración de mapeo
}

interface FieldMapping {
  [templateField: string]: string | FieldMappingConfig;
}

interface FieldMappingConfig {
  path: string;                 // Path al campo en outputJson (e.g., "data.serviceName")
  transform?: string;           // "upper" | "lower" | "trim"
  default?: any;                // Valor por defecto si no existe
  required?: boolean;           // Validar que no esté vacío
}
```

---

## 📤 Output

```typescript
interface FieldMapperOutput {
  success: boolean;
  mappedData?: Record<string, any>;  // Objeto plano con valores mapeados
  errors?: string[];                 // Errores de validación
}
```

---

## 🔄 Flujo de Ejecución

```
1. Recibir outputJson y mapping

2. Para cada templateField en mapping:

   a. Determinar configuración
      └─ String simple: path directo
      └─ Objeto: config completa

   b. Extraer valor
      └─ getValueByPath(outputJson, path)
      └─ Navegar por partes separadas por "."

   c. Aplicar transformaciones (si existen)
      └─ upper: toUpperCase()
      └─ lower: toLowerCase()
      └─ trim: trim()

   d. Usar default (si no existe valor)
      └─ Solo si value === null || undefined || ""

   e. Validar required
      └─ Si required && vacío → error

   f. Asignar a mappedData[templateField]

3. Si hay errores → success: false

4. Retornar mappedData
```

---

## 🧭 Path Navigation

### Sintaxis

Usa **dot notation** para navegar objetos anidados:

```typescript
// outputJson:
{
  "data": {
    "serviceName": {
      "value": "MyService"
    }
  }
}

// path: "data.serviceName.value"
// resultado: "MyService"
```

### Implementación

```typescript
private getValueByPath(obj: any, path: string): any {
  const parts = path.split(".");
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}
```

### Casos Especiales

- Path inexistente → `undefined`
- Null en medio del path → `undefined`
- Array en path → accede por índice numérico

---

## 🔧 Transformaciones

### upper

```typescript
{
  "serviceName": {
    "path": "data.serviceName",
    "transform": "upper"
  }
}

// Input: "myService"
// Output: "MYSERVICE"
```

### lower

```typescript
{
  "environment": {
    "path": "data.environment",
    "transform": "lower"
  }
}

// Input: "PRODUCTION"
// Output: "production"
```

### trim

```typescript
{
  "description": {
    "path": "data.description",
    "transform": "trim"
  }
}

// Input: "  My Service  "
// Output: "My Service"
```

---

## 💡 Ejemplo de Uso

### Configuración Simple (String Path)

```typescript
const mapper = new FieldMapperTool();

const result = await mapper.run({
  outputJson: {
    serviceName: "MyService",
    timeout: 5000
  },
  mapping: {
    service: "serviceName",      // Path directo
    delay: "timeout"
  }
});

console.log(result.mappedData);
// {
//   service: "MyService",
//   delay: 5000
// }
```

### Configuración Completa

```typescript
const result = await mapper.run({
  outputJson: {
    data: {
      serviceName: "myService",
      timeout: null,
      environment: "PROD"
    }
  },
  mapping: {
    serviceName: {
      path: "data.serviceName",
      transform: "upper",
      required: true
    },
    timeout: {
      path: "data.timeout",
      default: 30000
    },
    env: {
      path: "data.environment",
      transform: "lower"
    }
  }
});

console.log(result.mappedData);
// {
//   serviceName: "MYSERVICE",    // transformado a upper
//   timeout: 30000,              // default aplicado
//   env: "prod"                  // transformado a lower
// }
```

### Con Validación de Requeridos

```typescript
const result = await mapper.run({
  outputJson: {
    serviceName: "",       // Vacío
    timeout: 5000
  },
  mapping: {
    serviceName: {
      path: "serviceName",
      required: true       // ← Requerido pero vacío
    }
  }
});

console.log(result);
// {
//   success: false,
//   errors: ["Required field 'serviceName' is missing or empty"]
// }
```

---

## 🎨 Template Integration

### En config.json de Template

```json
{
  "name": "SOAP Request Generator",
  "outputFileName": "soap-request-{serviceName}.xml",
  "mapping": {
    "serviceName": {
      "path": "data.serviceName.value",
      "required": true
    },
    "systemId": {
      "path": "data.systemId.value",
      "default": "DEFAULT_SYSTEM"
    },
    "operationName": {
      "path": "data.operationName.value",
      "transform": "upper"
    }
  }
}
```

### Uso en ArtifactGeneratorAgent

```typescript
const mapperTool = new FieldMapperTool();

const mapResult = await mapperTool.run({
  outputJson: cleanJson,
  mapping: templateConfig.mapping
});

if (!mapResult.success) {
  console.error("Mapping errors:", mapResult.errors);
  return;
}

// Usar mappedData para renderizar template
const rendered = await templateRenderer.run({
  templateContent: templateContent,
  data: mapResult.mappedData,
  useContent: true
});
```

---

## 🛡️ Validación

### Campos Requeridos

```typescript
if (config.required && (value === null || value === undefined || value === "")) {
  errors.push(`Required field '${templateField}' is missing or empty`);
}
```

### Acumulación de Errores

- No falla al primer error
- Acumula todos los errores de validación
- Retorna lista completa en `errors[]`
- Permite ver todos los problemas de una vez

---

## 📊 Casos de Uso Avanzados

### Paths Anidados Profundos

```typescript
// outputJson:
{
  "service": {
    "metadata": {
      "info": {
        "name": "PaymentService"
      }
    }
  }
}

// mapping:
{
  "serviceName": "service.metadata.info.name"
}
```

### Múltiples Transformaciones (secuencial)

```typescript
// Nota: Solo soporta 1 transform por campo
// Para múltiples, usar default + transform
{
  "description": {
    "path": "data.description",
    "default": "  No description  ",  // Con espacios
    "transform": "trim"                // Los elimina
  }
}
```

### Arrays (acceso por índice)

```typescript
// outputJson:
{
  "operations": ["getUser", "createUser"]
}

// mapping:
{
  "firstOp": "operations.0"  // → "getUser"
}
```

---

## ⚠️ Limitaciones

- Solo 1 transformación por campo (no encadenables)
- Transformaciones solo para strings (otros tipos ignorados)
- No soporta JSONPath complejo (solo dot notation)
- No soporta wildcards en paths
- No soporta mapeo de arrays completos (solo elementos individuales)

---

## 🔗 Usado Por

- **ArtifactGeneratorAgent** - Mapea outputJson a datos de template

---

## 📍 Ubicación

`src/tools/fieldMapper.ts`
