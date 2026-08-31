# FileReaderTool

## 📋 Descripción

Herramienta simple y directa para **leer archivos del sistema de archivos**. Proporciona lectura segura con validación de existencia, manejo de errores y reporte de tamaño.

---

## 🎯 Propósito

- Leer archivos de texto desde el filesystem
- Validar existencia antes de leer
- Retornar contenido + metadata (tamaño, path)
- Manejo robusto de errores
- Codificación UTF-8 por defecto

---

## 📥 Input

```typescript
interface FileReaderInput {
  filePath: string;           // Path absoluto o relativo al archivo
}
```

---

## 📤 Output

```typescript
interface FileReaderOutput {
  success: boolean;
  content?: string;           // Contenido del archivo (UTF-8)
  error?: string;
  filePath: string;           // Path solicitado (para tracking)
  size?: number;              // Tamaño en bytes
}
```

---

## 🔄 Flujo de Ejecución

```
1. Recibir filePath

2. Validar existencia
   └─ existsSync(filePath)
   └─ Si no existe → error inmediato

3. Leer archivo
   └─ readFile(filePath, "utf-8")
   └─ Codificación UTF-8

4. Calcular tamaño
   └─ Buffer.byteLength(content, "utf-8")
   └─ Tamaño en bytes

5. Retornar resultado
   └─ Success: content + size
   └─ Error: mensaje descriptivo
```

---

## 💡 Ejemplo de Uso

### Archivo Existente

```typescript
const reader = new FileReaderTool();

const result = await reader.run({
  filePath: "/repo/build.json"
});

if (result.success) {
  console.log(`Read ${result.size} bytes from ${result.filePath}`);
  console.log(result.content);
}

// Output:
// {
//   success: true,
//   content: '{"serviceName": "MyService", ...}',
//   filePath: "/repo/build.json",
//   size: 1024
// }
```

### Archivo No Existente

```typescript
const result = await reader.run({
  filePath: "/non/existent/file.json"
});

console.log(result);

// Output:
// {
//   success: false,
//   error: "File not found: /non/existent/file.json",
//   filePath: "/non/existent/file.json"
// }
```

### Error de Lectura (Permisos)

```typescript
const result = await reader.run({
  filePath: "/root/protected.txt"
});

// Output:
// {
//   success: false,
//   error: "EACCES: permission denied, open '/root/protected.txt'",
//   filePath: "/root/protected.txt"
// }
```

---

## 🛡️ Manejo de Errores

### Tipos de Errores

1. **Archivo No Encontrado**
   ```
   File not found: /path/to/file.json
   ```

2. **Error de Permisos**
   ```
   EACCES: permission denied, open '/path/to/file'
   ```

3. **Error de Codificación**
   ```
   Invalid UTF-8 sequence (archivos binarios)
   ```

### Estrategia

- Validación temprana con `existsSync()`
- Try-catch completo para errores de I/O
- Mensaje de error preservado del sistema
- `success: false` en todos los errores

---

## 📊 Características

### Codificación

- **UTF-8** hardcoded
- No soporta archivos binarios directamente
- Para binarios, usar `fs` directamente con `encoding: null`

### Tamaño

- Calculado con `Buffer.byteLength()`
- Refleja tamaño en memoria (UTF-8)
- Puede diferir del tamaño en disco

### Paths

- Soporta paths absolutos y relativos
- Relativos resuelven desde `process.cwd()`
- Path retornado es el mismo recibido (sin normalización)

---

## 🔧 Casos de Uso

### 1. Leer Configuración

```typescript
const configResult = await reader.run({
  filePath: "./config/app.properties"
});

if (configResult.success) {
  const config = parseProperties(configResult.content!);
}
```

### 2. Leer Múltiples Archivos

```typescript
const files = [
  "/repo/build.json",
  "/repo/release.json",
  "/repo/package.json"
];

const results = await Promise.all(
  files.map(filePath => reader.run({ filePath }))
);

const successfulReads = results.filter(r => r.success);
console.log(`Read ${successfulReads.length}/${files.length} files`);
```

### 3. Con Validación de Tamaño

```typescript
const result = await reader.run({ filePath: "/large-file.json" });

if (result.success) {
  if (result.size! > 1_000_000) { // 1MB
    console.warn("Large file detected:", result.size, "bytes");
  }
  processContent(result.content!);
}
```

---

## ⚠️ Limitaciones

- Solo UTF-8 (no binarios, no otras codificaciones)
- Sin streaming (carga completo en memoria)
- Sin caché (re-lee en cada llamada)
- Sin normalización de paths
- No sigue symlinks (comportamiento de `readFile` por defecto)

---

## 🔗 Usado Por

- **ReaderAgent** - Lee build.json, release.json, archivos de repo
- **RepoExplorerTool** - Lee contenido de archivos filtrados (cuando `includeContent: true`)

---

## 📍 Ubicación

`src/tools/fileReader.ts`
