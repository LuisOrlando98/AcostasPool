# 0006 - Worker cron idempotente

## Estado

Aceptada (en producción).

## Contexto

`scripts/cron-worker.ts` es un proceso separado del servicio web y puede reiniciarse (deploy,
caída, restart de Render) a mitad de un tick. Varias tareas tienen efectos visibles hacia afuera
(un correo enviado al cliente, un digest enviado al técnico) que no deben duplicarse ni perderse
si el proceso muere entre "empezar a procesar" y "marcar como hecho".

## Decisión

Cada tarea reclama su propio trabajo con una operación atómica antes de ejecutarlo, en vez de
leer y procesar en pasos separados:

- `src/lib/worker/customer-notifications.ts#processCustomerNotifications`: reclama un lote de
  `Notification` `QUEUED` con un `updateMany` (a `PROCESSING`, `attempts + 1`, `lastAttemptAt =
  now`) y solo procesa las filas que ese `updateMany` efectivamente marcó; al inicio de cada tick
  recupera `PROCESSING` huérfanos (más viejos que `PROCESSING_ORPHAN_THRESHOLD_MS`) a `QUEUED` o
  los marca `FAILED` si ya agotaron sus intentos, y reencola `FAILED` cuyo backoff
  (`src/lib/worker/retry.ts`, exponencial: 2, 4, 8, 16 min, tope 1 h, máx. 5 intentos) ya venció.
- `src/lib/worker/tech-digests.ts`: busca el `TechDigest` por su clave única
  (`technicianId, routeDate, window`) y lo reutiliza si existe; una fila `SENT` nunca se
  reprocesa, una `PROCESSING` reciente se considera en curso y se salta.
- `src/lib/jobs/materialize.ts#materializeServicePlanJob`: comprueba `(planId, scheduledDate)`
  antes de crear un `Job`, así que ejecutar la misma ocurrencia dos veces (por ejemplo, un tick
  del worker que se solapa con la materialización manual desde la ficha de cliente) no duplica
  la visita.

## Consecuencias

- Positivo: un restart de Render a mitad de un envío nunca duplica un correo ya enviado (la fila
  `SENT` no se reprocesa) ni lo pierde silenciosamente (una `PROCESSING` huérfana se recupera en
  el siguiente tick). `src/lib/worker/scheduler.ts#createTaskRunner` además evita que dos ticks
  de la misma tarea se solapen si la anterior sigue en curso.
- Negativo: la idempotencia se construye a mano en cada tarea — no hay un framework de colas de
  trabajo (tipo BullMQ) que la provea de fábrica. Añadir una tarea nueva con efectos externos
  obliga a replicar el mismo patrón (claim atómico → procesar → resolver estado final →
  recuperar huérfanos) o arriesgarse a duplicados; nada en el tipo `WorkerTask` fuerza a seguir
  el patrón.
