# FlowOrchestrator (Motor de Ejecución de Flujos)

Con la introducción del `MasterOrchestratorAgent`, el rol del `FlowOrchestrator` ha sido refactorizado. Ya no es el orquestador principal del sistema, sino un **motor de ejecución de flujos** más simple y enfocado.

Es invocado por el `MasterOrchestratorAgent` para manejar la ejecución de un único flujo a la vez.

---

## Responsabilidades Actuales

1.  **Ejecución de un Solo Flujo**: Su método principal, `executeFlow(flowName, context)`, recibe el nombre de un flujo y un objeto de contexto opcional.

2.  **Resolución de Placeholders**: Antes de ejecutar el flujo, su responsabilidad más importante es usar el `context` recibido para resolver placeholders en la configuración del flujo.
    -   **Ejemplo**: Si recibe el contexto `{ "operationName": "enviarAlerta" }`, buscará y reemplazará todas las instancias de `{operationName}` en las rutas de salida del flujo.
    -   Esto permite que una definición de flujo genérica (como `operationDiscovery`) pueda generar archivos con nombres únicos y dinámicos (ej. `output/intermediate-data/operations/enviarAlerta.json`).

3.  **Carga de Configuración**: Carga la definición del flujo solicitado desde `flow-configuration.json`.

4.  **Validación de Fuentes**: Invoca al `SourceResolver` para asegurarse de que todas las fuentes de datos del flujo (ej. archivos en `resources/repo`) existan y sean accesibles.

5.  **Invocación del `FlowExecutor`**: Una vez que la configuración del flujo está completamente resuelta (con las rutas de salida dinámicas ya definidas), le pasa el control al `FlowExecutor` para que este ejecute el pipeline de 4 fases (Reader, Analyzer, Writer, Generator).

---

## Interacción en el Nuevo Modelo

En la arquitectura actual, el `FlowOrchestrator` actúa como un puente entre la lógica de alto nivel del `MasterOrchestratorAgent` y la ejecución de bajo nivel del `FlowExecutor`.

```
 MasterOrchestratorAgent
 "Ejecuta el flujo 'operationDiscovery'
  para la operación 'op1'"
           │
           │ flowName: "operationDiscovery"
           │ context: { operationName: "op1" }
           ▼
 ┌───────────────────┐
 │ FlowOrchestrator  │
 │ ----------------- │
 │ 1. Resuelve la    │
 │    ruta de salida:│
 │    "../ops/{op1}.json"
 │                   │
 │ 2. Llama a        │
 │    FlowExecutor  │
 │    con la ruta   │
 │    resuelta.     │
 └───────────────────┘
           │
           ▼
      FlowExecutor
 (Ejecuta el pipeline de 4 fases)
```