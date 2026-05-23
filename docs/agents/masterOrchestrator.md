# MasterOrchestratorAgent

El `MasterOrchestratorAgent` es el agente principal y el "cerebro" del sistema de orquestación. A diferencia de los agentes de fase (Reader, Analyzer, etc.) que tienen una única responsabilidad dentro de un flujo, el `MasterOrchestratorAgent` opera a un nivel superior, coordinando la ejecución de múltiples flujos de trabajo en una secuencia lógica y dinámica.

---

## Responsabilidades Clave

1.  **Ejecución Basada en Pasos (`Steps`)**: Su comportamiento se define por la sección `orchestrationSteps` en `flow-configuration.json`. Ejecuta cada "paso" en orden secuencial, y solo avanza al siguiente si el actual tiene éxito.

2.  **Gestión del Contexto de Ejecución**: Mantiene un contexto a lo largo de toda la ejecución, permitiendo que los resultados de un paso (`step`) se utilicen para configurar el siguiente. Esto es fundamental para los flujos de trabajo dinámicos.

3.  **Orquestación de Flujos Dinámicos**: Su característica más potente es el `dynamicScope`. Permite iterar sobre una lista de elementos (extraída de un paso anterior) y ejecutar un conjunto de flujos para cada elemento.
    -   **Ejemplo práctico**: El paso `serviceDiscovery` descubre una lista de operaciones: `["op1", "op2"]`. El `MasterOrchestratorAgent` guarda esta lista en su contexto. El siguiente paso, `operationProcessing`, utiliza `dynamicScope` para ejecutar los flujos `operationDiscovery` y `bddScenarios` dos veces: una para `op1` y otra para `op2`, pasando el nombre de la operación como contexto en cada ejecución.

4.  **Invocación del `FlowOrchestrator`**: Para ejecutar los flujos de un paso, el `MasterOrchestratorAgent` delega la tarea al `FlowOrchestrator`. Le pasa el nombre del flujo a ejecutar y cualquier contexto dinámico relevante (como el `operationName` actual).

5.  **Framework de Validación**: Después de completar la ejecución de los flujos de un paso, invoca a una serie de validadores para verificar la calidad de los resultados antes de continuar.
    -   `FileExistenceValidator`: ¿Se crearon los archivos?
    -   `SchemaValidator`: ¿Los JSON generados son válidos según su esquema?
    -   `ContentValidator` (LLM): ¿El contenido de los archivos tiene sentido? (ej. no está vacío, no contiene errores obvios).
    -   `CrossFlowValidator` (LLM): ¿Son los resultados de este paso consistentes con los de pasos anteriores?

6.  **Política de Reintentos (`RetryPolicy`)**: Si una validación falla, el agente puede reintentar la ejecución del paso completo un número configurable de veces, con un tiempo de espera (`backoff`) entre intentos.

---

## Flujo de Trabajo Interno de un Paso

Para cada `step` en su configuración, el `MasterOrchestratorAgent` sigue este proceso:

```
1. Iniciar Paso
   │
   ├─ ¿Tiene `dynamicScope`?
   │  ├─ Sí: Itera sobre la lista del contexto (ej: operaciones).
   │  └─ No: Se prepara para una única ejecución.
   │
   ├─ Para cada ejecución (sea única o una iteración del bucle):
   │  └─ Llama a `FlowOrchestrator` para ejecutar los flujos del paso (`sequential` o `parallel`).
   │     └─ `FlowOrchestrator` ejecuta el pipeline de 4 fases y espera el resultado.
   │
   ├─ Recopila todos los resultados de los flujos ejecutados en el paso.
   │
   ├─ Ejecutar Validaciones
   │  │
   │  ├─ Si la validación falla y hay reintentos:
   │  │  └─ Esperar y volver al inicio del paso.
   │  │
   │  └─ Si la validación falla y no hay más reintentos:
   │     └─ Marcar el paso como fallido y detener toda la orquestación.
   │
   ├─ Si las validaciones son exitosas:
   │  └─ Ejecutar acciones `onSuccess` (ej. extraer datos para el siguiente paso).
   │
   └─ Marcar el paso como exitoso y pasar al siguiente.
```
