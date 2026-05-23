# RepoExplorerTool

## 📋 Descripción

Herramienta que **explora recursivamente directorios** buscando archivos que coincidan con criterios específicos (extensiones, patrones, profundidad). Opcionalmente lee el contenido de los archivos encontrados.

---

## 🎯 Propósito

- Explorar directorios recursivamente
- Filtrar archivos por extensión (`.ts`, `.json`, `.xml`)
- Filtrar archivos por patrón en nombre
- Limitar profundidad de búsqueda
- Opcionalmente cargar contenido de archivos
- Retornar metadata (path, tamaño, extensión)

---

## 📥 Input

```typescript
interface RepoExplorerInput {
  repoPath: string;           // Directorio raíz a explorar
  pattern?: string;           // Patrón en nombre de archivo
  extensions?: string[];      // Extensiones permitidas ([".ts", ".json"])
  maxDepth?: number;          // Profundidad máxima (default: 10)
  includeContent?: boolean;   // Leer contenido de archivos (default: false)
}
```

---

## 📤 Output

```typescript
interface RepoExplorerOutput {
  success: boolean;
  files: FileInfo[];          // Archivos encontrados
  totalFiles: number;         // Cantidad de archivos
  error?: string;
  repoPath: string;           // Path explorado
}

interface FileInfo {
  path: string;               // Path absoluto
  relativePath: string;       // Path relativo al repoPath
  extension: string;          // Extensión (.ts, .json)
  size: number;               // Tamaño en bytes
  content?: string;           // Contenido (si includeContent: true)
}
```

---

## 🔄 Flujo de Ejecución

```
1. Recibir repoPath y criterios de filtrado

2. Iniciar exploración recursiva
   └─ exploreDirectory(repoPath, depth: 0)

3. Para cada entrada en directorio:

   a. Si es directorio:
      └─ Llamada recursiva (depth + 1)
      └─ Detener si depth >= maxDepth

   b. Si es archivo:
      └─ Verificar patrón (si especificado)
      └─ Verificar extensión (si especificado)
      └─ Si matches → agregar a results

4. Para archivos que pasan filtros:
   └─ Obtener stats (tamaño)
   └─ Calcular relativePath
   └─ Si includeContent: leer archivo
   └─ Agregar FileInfo a results

5. Retornar lista completa
```

---

## 🔍 Filtrado

### Por Extensión

```typescript
const result = await explorer.run({
  repoPath: "/my-repo",
  extensions: [".ts", ".json"]
});

// Encuentra solo archivos .ts y .json
// Ignora: .md, .txt, .xml, etc.
```

### Por Patrón

```typescript
const result = await explorer.run({
  repoPath: "/my-repo",
  pattern: "config"
});

// Encuentra archivos con "config" en el nombre:
// - app.config.ts ✓
// - config.json ✓
// - database-config.xml ✓
// - service.ts ✗
```

### Combinado

```typescript
const result = await explorer.run({
  repoPath: "/my-repo",
  extensions: [".properties"],
  pattern: "application"
});

// Encuentra solo:
// - application.properties ✓
// - application-dev.properties ✓
// - app.properties ✗ (no contiene "application")
// - application.json ✗ (extensión incorrecta)
```

---

## 📊 Profundidad

### Default (maxDepth: 10)

```typescript
const result = await explorer.run({
  repoPath: "/my-repo"
});

// Busca hasta 10 niveles de profundidad
```

### Profundidad Limitada

```typescript
const result = await explorer.run({
  repoPath: "/my-repo",
  maxDepth: 2
});

// Estructura:
// /my-repo/           (depth 0)
//   src/              (depth 1)
//     index.ts        ✓ encontrado
//     utils/          (depth 2)
//       helper.ts     ✓ encontrado
//       lib/          (depth 3)
//         tool.ts     ✗ ignorado (excede maxDepth)
```

---

## 💡 Ejemplo de Uso

### Exploración Básica (sin contenido)

```typescript
const explorer = new RepoExplorerTool();

const result = await explorer.run({
  repoPath: "/my-repo/src",
  extensions: [".ts"]
});

console.log(`Found ${result.totalFiles} TypeScript files`);

result.files.forEach(file => {
  console.log(`- ${file.relativePath} (${file.size} bytes)`);
});

// Output:
// Found 15 TypeScript files
// - index.ts (1024 bytes)
// - agents/reader.ts (2048 bytes)
// - tools/fileReader.ts (1536 bytes)
// ...
```

### Con Contenido

```typescript
const result = await explorer.run({
  repoPath: "/my-repo/config",
  extensions: [".properties"],
  includeContent: true
});

for (const file of result.files) {
  console.log(`\n=== ${file.relativePath} ===`);
  console.log(file.content);
}

// Output:
// === app.properties ===
// server.port=8080
// db.host=localhost
//
// === database.properties ===
// db.url=jdbc:postgresql://...
```

### Buscar Archivos de Configuración

```typescript
const result = await explorer.run({
  repoPath: "/my-repo",
  pattern: "config",
  extensions: [".json", ".xml", ".properties"],
  maxDepth: 5,
  includeContent: true
});

const configFiles = result.files.map(f => ({
  name: f.relativePath,
  type: f.extension,
  content: f.content
}));

// Retorna todos los archivos de configuración
// con su contenido completo
```

---

## 🧹 Contenido de Archivos

### includeContent: true

```typescript
const result = await explorer.run({
  repoPath: "/repo",
  extensions: [".txt"],
  includeContent: true
});

result.files[0].content;
// "This is the file content..."
```

### Archivos Binarios

```typescript
// Si encuentra un archivo binario con includeContent: true:
{
  path: "/repo/image.png",
  content: "[Binary or unreadable file]"  // ← Placeholder
}
```

**Implementación**:
```typescript
if (includeContent) {
  try {
    fileInfo.content = await readFile(fullPath, "utf-8");
  } catch {
    fileInfo.content = "[Binary or unreadable file]";
  }
}
```

---

## 📁 Paths

### Path Absoluto

```typescript
file.path = "/mnt/c/Users/.../my-repo/src/index.ts"
```

### Path Relativo

```typescript
// repoPath: "/mnt/c/Users/.../my-repo"
file.relativePath = "src/index.ts"
```

**Cálculo**:
```typescript
import { relative } from "node:path";
const relativePath = relative(basePath, fullPath);
```

---

## 🎯 Caso de Uso Real: ReaderAgent

```typescript
// ReaderAgent usa RepoExplorer con sourceHints

const repoResult = await repoExplorer.run({
  repoPath: input.repoPath,
  extensions: sourceHints.fileExtensions,        // [".properties", ".xml"]
  maxDepth: sourceHints.maxDepth || 10,
  includeContent: true
});

// Filtra archivos relevantes
const relevantFiles = repoResult.files.filter(file => {
  // Aplicar filtros de directorio, patrones, etc.
  if (sourceHints.excludeDirectories?.some(dir => file.relativePath.includes(dir))) {
    return false;
  }
  return true;
});

// Prepara fuente "repository"
const repositorySource = {
  name: "repository",
  data: {
    files: relevantFiles.map(f => ({
      path: f.relativePath,
      content: f.content,
      size: f.size
    }))
  }
};
```

---

## ⚠️ Limitaciones

- **Pattern Matching**: Solo `includes()`, no regex ni glob avanzado
- **Symlinks**: No los sigue (comportamiento de readdir por defecto)
- **Hidden Files**: Incluye archivos ocultos (`.gitignore`, `.env`)
- **Performance**: Sin caché, explora completo cada vez
- **Memoria**: Con `includeContent: true`, carga todos los archivos en memoria

---

## 🚀 Optimizaciones Posibles

### Excluir Directorios Comunes

```typescript
// En la implementación, agregar:
const excludeDirs = ["node_modules", ".git", "dist", "build"];

if (entry.isDirectory() && excludeDirs.includes(entry.name)) {
  continue; // Skip
}
```

### Límite de Archivos

```typescript
// Detener búsqueda después de N archivos
if (results.length >= maxFiles) {
  return;
}
```

---

## 🔗 Usado Por

- **ReaderAgent** - Explora repositorio buscando archivos relevantes según sourceHints

---

## 📍 Ubicación

`src/tools/repoExplorer.ts`
