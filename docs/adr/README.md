# Registro de decisiones de arquitectura (ADR)

Estado: 18 sep 2026. Cada ADR sigue el formato corto **Contexto / Decisión / Consecuencias**.
Se numeran de forma secuencial y no se editan retroactivamente: una decisión que cambia se
documenta en un ADR nuevo que referencia al que reemplaza (ninguno de los siguientes ha sido
reemplazado todavía).

| # | Título | Resumen |
| --- | --- | --- |
| [0001](./0001-render-en-vez-de-vercel.md) | Render en vez de Vercel | Hosting en Render (web + worker + Postgres) en lugar de un plan serverless, porque el worker cron necesita un proceso persistente. |
| [0002](./0002-pusher-con-fallback-sse.md) | Pusher con fallback SSE | Tiempo real con Pusher como canal principal y un bus SSE en memoria como respaldo sin configuración. |
| [0003](./0003-playwright-pdf-fallback-pdf-lib.md) | Playwright para PDF, fallback pdf-lib | El PDF de invoice se renderiza con Chromium/Playwright y cae a `pdf-lib` si el navegador no está disponible. |
| [0004](./0004-site-settings-cms-json.md) | SiteSettings como CMS en JSON | Contenido editable (plantillas, copy, cumplimiento) en columnas `Json` de una fila única, cada una con su normalizador. |
| [0005](./0005-proxy-guards-servidor.md) | Proxy de rutas + guards en servidor | Dos capas de autorización: `src/proxy.ts` (cookie, redirección temprana) y `src/lib/auth/guards.ts` (base de datos, autoridad real). |
| [0006](./0006-worker-cron-idempotente.md) | Worker cron idempotente | Cada tarea reclama su trabajo de forma atómica y recupera huérfanos, para que un restart no duplique ni pierda envíos. |
| [0007](./0007-coordenadas-persistidas-property.md) | Coordenadas persistidas en `Property` | `lat`/`lng`/`geocodedAt` se guardan y reutilizan para no re-geocodificar en cada plan de rutas. |
| [0008](./0008-tests-caracterizacion-antes-de-refactorizar.md) | Tests de caracterización antes de refactorizar | Antes de tocar lógica no trivial o aplicar migraciones de datos, se fija el comportamiento actual con pruebas y se exige idempotencia. |

## Cuándo escribir un ADR nuevo

- Se cambia de proveedor, protocolo o estrategia para algo que ya tenía un ADR (se referencia el
  anterior y se explica qué cambió).
- Se introduce un patrón nuevo que otros módulos van a replicar (p. ej. otra columna `Json` como
  CMS, otra tarea de worker con su propia estrategia de reintento).
- La decisión no es obvia leyendo el código: alguien podría razonablemente preguntar "¿por qué no
  se hizo de la otra forma?".
