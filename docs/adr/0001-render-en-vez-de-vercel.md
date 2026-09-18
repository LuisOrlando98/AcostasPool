# 0001 - Render en vez de Vercel

## Estado

Aceptada (en producción).

## Contexto

La documentación previa (`docs/Architecture.md` anterior a esta revisión) proponía Vercel como
hosting "recomendado" y trataba la infraestructura de producción como algo "futuro". En la
práctica, el proyecto tiene dos necesidades que no encajan con un modelo puramente serverless:

- Un **worker cron de proceso largo** (`scripts/cron-worker.ts`, ejecutado con `node-cron` desde
  `src/lib/worker/scheduler.ts`) que agenda tareas recurrentes (notificaciones, digests, planes
  recurrentes, asistente de rutas) y necesita seguir vivo entre ticks, no invocarse una función
  por evento.
- **Playwright + Chromium** para el PDF de invoice (`src/lib/invoices/pdf.ts`), que requiere
  instalar un binario de navegador (`npx playwright install chromium`) en el entorno de build/runtime.
- Una base de datos **Postgres administrada** con migraciones (`prisma migrate deploy`) que deben
  correr antes de que el nuevo código reciba tráfico.

## Decisión

Desplegar en **Render**, con `render.yaml` como fuente única de verdad: dos servicios (`web`
tipo `web`, `worker` tipo `worker`) y una base de datos Postgres administrada
(`acostaspool-db`). El servicio web instala dependencias e instala Chromium en su
`buildCommand`; ambos servicios corren `npx prisma migrate deploy` en `preDeployCommand` (con
reintentos) antes de arrancar; el worker arranca con `npm run worker:cron`.

## Consecuencias

- Positivo: el worker es un proceso Node persistente real, sencillo de razonar y depurar (un
  `createLogger` con prefijo `[cron-worker]`, tareas con su propio cron listadas al arrancar).
  Postgres administrado en el mismo proveedor. Toda la configuración de despliegue vive
  versionada en `render.yaml`, no en la UI de un dashboard.
- Negativo: el plan `plan: free` de `acostaspool-db` **no tiene backups ni point-in-time
  recovery** (comentario explícito en `render.yaml`) — pasar a un plan de pago con backups es una
  decisión de negocio pendiente, no técnica. Render no ofrece el edge network ni el despliegue
  por rama automático de Vercel. `render.yaml` y `.env.example` deben mantenerse sincronizados a
  mano (no hay validación automática de que coincidan).
