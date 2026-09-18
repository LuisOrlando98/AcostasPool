# AcostasPool Service Administration System

Plataforma web para administracion de servicios a piscinas: rutas, evidencias e invoices.

## Modo de trabajo
Este proyecto esta configurado para ejecutar pruebas y despliegues en Render.

## Deploy en Render
1. Crea servicios con `render.yaml` (web + worker + postgres).
2. Define estas variables en el servicio web (las marcadas con `sync: false` se cargan desde el dashboard):
   - Obligatorias: `DATABASE_URL` (la aporta la base de datos), `AUTH_SECRET`, `APP_URL`
   - `CRON_SECRET`
   - `STORAGE_DRIVER` (`local` o `s3`) y, con `s3`, `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` y opcionalmente `NEXT_PUBLIC_CDN_URL`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `CONTACT_INBOX_EMAIL`
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` y `GOOGLE_MAPS_SERVER_API_KEY`
   - `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` (ver "Notificaciones en tiempo real")
   - `BUSINESS_TIMEZONE`
3. Define estas variables en el worker (`acostaspool-cron-worker`):
   - `APP_URL` y `CRON_SECRET`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `CONTACT_INBOX_EMAIL`
   - `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`, `GOOGLE_MAPS_SERVER_API_KEY`, `BUSINESS_TIMEZONE` (el worker usa los modulos de `src/`: publica en Pusher las notificaciones que crea y calcula el dia de negocio con `BUSINESS_TIMEZONE`)
4. Base de datos: `render.yaml` la deja en `plan: free`, que no incluye backups ni point-in-time recovery. Para produccion usa un plan de pago con backups.
5. Haz deploy y valida:
   - Logs del servicio web al arrancar: las lineas `[env]` avisan de integraciones sin configurar; en produccion el arranque aborta si falta una variable obligatoria.
   - `GET /api/health`
   - `GET /api/health/db` (requiere sesion de administrador con acceso developer)
   - Logs del worker: al arrancar imprime las advertencias `[env]` y las tareas programadas; despues solo registra los ticks con actividad (envios, reintentos, trabajos creados) y los errores. Ver "Worker cron".

## Instalacion como app (PWA)
1. Publica la app en HTTPS (por ejemplo Render).
2. Abre la URL desde el telefono del tecnico.
3. Instala:
   - Android (Chrome): menu > `Instalar app`.
   - iPhone (Safari): compartir > `Agregar a pantalla de inicio`.
4. Si no aparece la opcion de instalar, abre la app una vez y recarga.

## Flujo de migraciones
1. Sube los cambios con la carpeta `prisma/migrations` al repositorio.
2. Haz deploy en Render.
3. Render ejecuta `preDeployCommand` con `npx prisma migrate deploy` y aplica migraciones antes de iniciar la app.

## Worker cron
`npm run worker:cron` ejecuta `scripts/cron-worker.ts` con `tsx` (dependencia de desarrollo; Render instala con `npm install --include=dev`). La logica vive en `src/lib/worker/` y reutiliza los modulos de `src/lib`: plantillas de correo (`email-templates.ts`, con los textos que edita el administrador en `SiteSettings.emailTemplates`), zona horaria (`timezone.ts`), materializacion de planes (`jobs/materialize.ts`) y envio SMTP (`mail/transport.ts`, que siempre deja una fila `EmailLog`). Al arrancar valida el entorno con `src/lib/config/env.ts` (advertencias `[env]`; con `NODE_ENV=production` aborta si falta o es invalida `DATABASE_URL`, `APP_URL` o la zona horaria; `AUTH_SECRET` no es necesaria en el worker) y ejecuta una vez los planes recurrentes.

Tareas (cron evaluado en `BUSINESS_TIMEZONE`):
| Tarea | Cron | Que hace |
| --- | --- | --- |
| `customer-notifications` | `*/2 * * * *` | Envia por correo las `Notification` QUEUED de clientes (`SERVICE_SCHEDULED`, `SERVICE_RESCHEDULED`, `JOB_COMPLETED`). Reclama el lote con un `updateMany` atomico (`PROCESSING`, `attempts + 1`, `lastAttemptAt`) y procesa solo las filas reclamadas; devuelve a QUEUED los `PROCESSING` huerfanos (mas de 10 minutos) y reintenta los `FAILED` con backoff exponencial (2, 4, 8, 16 minutos) hasta 5 intentos. |
| `digest-retry` | `*/2 * * * *` | Reintenta los digests de tecnicos del dia en `FAILED` (o `PROCESSING` huerfanos) con el mismo backoff; los intentos se cuentan por las filas `EmailLog` del digest. |
| `recurring-plans` | `*/10 * * * *` y al arrancar | Materializa las visitas de los planes activos para los proximos 28 dias con `materializeServicePlanJob` (nunca duplica una fecha del plan), encola los avisos al cliente y al tecnico y avanza `nextRunAt`. |
| `route-assistant-auto` | `0 7 * * *` | `POST /api/internal/routes/assistant/auto-optimize` con la cabecera `x-cron-secret` (requiere `APP_URL` y `CRON_SECRET`). |
| `morning-digest` | `30 6 * * *` | Plan diario (`TechDigest` MORNING) a cada tecnico con trabajos hoy. |
| `midday-digest` / `evening-digest` | `0 12 * * *` / `0 21 * * *` | Cambios de ruta del dia (`TechDigestItem` sin digest) agrupados por tecnico. |

Los digests se buscan por `(technicianId, routeDate, window)` y se reutilizan: uno ya enviado no se repite y los items que lleguen despues quedan para la siguiente ventana. Un tick que llega mientras la misma tarea sigue en curso se omite y se registra.

- `npm run worker:cron -- --once`: ejecuta cada tarea una vez, en orden, y termina (codigo de salida 1 si alguna fallo). Prueba de humo local: `set -a; . ./.env; set +a; npm run worker:cron -- --once`.
## Variables de entorno
La referencia completa, agrupada y comentada, esta en `.env.example`; copialo a `.env` para desarrollo local. El inventario y las reglas de validacion viven en `src/lib/config/env.ts` y se ejecutan al arrancar el servidor desde `src/instrumentation.ts`:
- En cualquier entorno se imprimen advertencias `[env]` por cada integracion sin configurar o incompleta.
- Con `NODE_ENV=production` el arranque aborta si falta o es invalida una variable obligatoria (o una `AWS_*` cuando `STORAGE_DRIVER=s3`). El build nunca se ve afectado.

### Obligatorias
| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Cadena de conexion PostgreSQL para Prisma (`postgresql://...`). |
| `AUTH_SECRET` | Secreto para firmar los tokens de sesion; minimo 32 caracteres. Rotarlo cierra todas las sesiones. |
| `APP_URL` | Origen publico de la app; se usa en enlaces de e-mail y desde el worker. |

### Recomendadas
| Variable | Uso | Sin ella |
| --- | --- | --- |
| `CRON_SECRET` | Cabecera `x-cron-secret` entre el worker y `/api/internal/routes/assistant/auto-optimize`. | El endpoint rechaza todas las llamadas y el worker omite la optimizacion diaria. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Correo transaccional (invitaciones, reset de password, facturas, fotos, cotizaciones, digests). | No se envia ningun correo. `SMTP_PORT` por defecto 587; `SMTP_FROM` por defecto `SMTP_USER`. |
| `CONTACT_INBOX_EMAIL` | Buzon de cotizaciones y respuestas de integraciones publicas. | Se usa `SMTP_USER`. |
| `TRUSTED_PROXY_HOPS` | Numero de proxies delante de la app. `x-forwarded-for` crece por la derecha, asi que la IP real es la entrada situada a esas posiciones del final; en Render vale `1` (subelo si añades un CDN). | Por defecto `1` en produccion y `0` en desarrollo; con `0` se ignora la cabecera porque el cliente puede falsearla. |
| `PUBLIC_INTEGRATION_TOKENS` | Lista separada por comas de los tokens que abren `/new-integrations/<token>` y su endpoint de respuesta. Para rotar: publica el token nuevo, manten el viejo mientras sus enlaces sigan vivos y luego quitalo. | Se usa el token por defecto incrustado en `src/lib/public-integrations.ts` (para no romper enlaces ya enviados) y se registra un aviso en produccion. |
| `STORAGE_DRIVER` | `local` (archivos bajo `public/`, una sola instancia) o `s3`. | Se comporta como `local`. |
| `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Credenciales S3. Obligatorias cuando `STORAGE_DRIVER=s3`. | Fallan subidas, avatares y PDFs de facturas. |
| `NEXT_PUBLIC_CDN_URL` | Base publica (CDN) de los assets en S3. | Se usa la URL del bucket. |
| `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER` | Publicacion de notificaciones en tiempo real desde el servidor. | Bus en memoria por instancia (ver abajo). |
| `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` | Suscripcion desde el navegador; deben coincidir con `PUSHER_KEY`/`PUSHER_CLUSTER`. Se incrustan en el build. | El navegador usa el stream SSE de la instancia. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Autocompletado de direcciones en el navegador. | Autocompletado desactivado. |
| `GOOGLE_MAPS_SERVER_API_KEY` (alias `GOOGLE_MAPS_API_KEY`) | Geocoding y Route Assistant en el servidor. | Geocoding y asistente de rutas desactivados. |
| `BUSINESS_TIMEZONE` / `NEXT_PUBLIC_BUSINESS_TIMEZONE` | Zona horaria IANA del negocio; `NEXT_PUBLIC_*` tiene prioridad. Un valor invalido impide arrancar. | `America/New_York`. |

### Opcionales
| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_NOTIFICATION_SOUND_URL` | Sonido de alerta personalizado (por defecto `/sounds/notification.mp3`). |
| `NEXT_PUBLIC_LANDING_YOUTUBE_ID`, `NEXT_PUBLIC_LANDING_SERVICES_BG_VIDEO_SRC`, `NEXT_PUBLIC_LANDING_SERVICES_BG_VIDEO_ENABLED` | Contenido multimedia de la landing. |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_TECH_EMAIL`, `SEED_TECH_PASSWORD`, `SEED_CUSTOMER_EMAIL`, `SEED_CUSTOMER_PASSWORD` | Cuentas demo de `npm run db:seed` (solo desarrollo y CI). Sin la contraseña, el seed genera una aleatoria y la imprime una sola vez; con `NODE_ENV=production` aborta. |
| `E2E_BASE_URL` | URL base para Playwright (por defecto `http://localhost:3000`). |

## Notificaciones en tiempo real
Las notificaciones se publican por Pusher cuando `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET` y `PUSHER_CLUSTER` estan definidas, y el navegador se suscribe con `NEXT_PUBLIC_PUSHER_KEY` y `NEXT_PUBLIC_PUSHER_CLUSTER`. Sin ellas la app cae a un bus en memoria por instancia (`src/lib/notifications/bus.ts`) servido por SSE en `/api/notifications/stream`: solo llegan a los navegadores conectados a la misma instancia, no sobreviven a un reinicio y no reciben nada publicado por otros procesos (por ejemplo el worker). En produccion, o con mas de una instancia, configura Pusher.

## Proteccion de rutas
`src/proxy.ts` (convencion `proxy` de Next 16, antes `middleware`) se ejecuta antes de renderizar `/admin`, `/tech` y `/client`: sin cookie de sesion valida redirige a `/login?next=<ruta>` y con un rol distinto al de la seccion redirige a `/unauthorized?next=<inicio del rol>`. Los guards de servidor de `src/lib/auth/guards.ts` siguen siendo la fuente de verdad (usuario activo, rol en base de datos, acceso developer); el proxy solo adelanta la redireccion y conserva `?next=`.

## Vista de desarrollador
La cuenta de desarrollador (correo incluido en `DEFAULT_DEVELOPER_EMAILS` de `src/lib/auth/developer.ts`) puede recorrer la aplicacion como administrador, tecnico o cliente sin cerrar sesion y **sin usar credenciales ajenas**.

- **Donde esta**: en la cabecera superior, junto a la campana de notificaciones. En escritorio es un control segmentado de tres posiciones (Administrador / Tecnico / Cliente, `role="radiogroup"` con `aria-checked` en la vista activa); por debajo de `lg` es un boton de icono (`aria-haspopup="menu"`) que despliega las mismas tres opciones. Es el unico punto de cambio de vista y aparece igual en las tres. No añade peticiones: `AppShell` le pasa `isDeveloper` y la vista activa desde la llamada a `/api/auth/me` que ya hacia.
- **Que cambia**: `POST /api/developer/view` con `{ "role": "ADMIN" | "TECH" | "CUSTOMER" }` escribe la cookie `ap_dev_view` (httpOnly, `SameSite=Lax`, `Secure` en produccion, 12 h) con **solo el rol**; con `ADMIN` la borra. La sesion sigue siendo la del desarrollador (`session.sub` = su id, su correo y su nombre) y lo unico que cambia es `session.role`.
- **Registros de prueba**: la primera vez que se entra en la vista de tecnico o de cliente se crean, de forma idempotente (`upsert` por `userId`, `src/lib/auth/dev-view-records.ts`), las filas propias del desarrollador: un `Technician` (nota `Cuenta de pruebas del desarrollador`, color por defecto) y un `Customer` (nombre = su nombre, apellidos `(pruebas)`, su correo, `ACTIVE` / `RESIDENTIAL`, idioma el de su usuario) con UNA `Property` llamada `Propiedad de pruebas` en `123 Test St, Miami, FL`. **Son filas reales y aparecen en los listados de administracion**: el cliente se reconoce por el sufijo `(pruebas)` en los apellidos y ambos por la nota `Cuenta de pruebas del desarrollador`. Si se borran a mano, la sesion cae a la vista de administrador y se vuelven a crear al cambiar de vista.
- **Quien puede usarla**: el POST resuelve el usuario REAL desde la cookie de sesion y la base de datos (no desde `getSession()`, que mientras la vista esta activa ya devuelve el rol emulado) y aplica el mismo criterio que `getSession()`: la marca `isDeveloper` sobre un correo de la lista, o el correo de la lista por si solo. El resto recibe `403` con `code: "NOT_DEVELOPER"`, y el control muestra "Tu cuenta no esta marcada como desarrollador" en vez de un error generico.
- **Permisos (claim `dev`)**: el POST vuelve a firmar `ap_session` con `dev: true`, conservando la caducidad del token anterior, para que `src/proxy.ts` (que solo lee el JWT, nunca la base de datos) deje pasar `/admin`, `/tech` y `/client`. Por eso una sesion abierta antes de que existiera el claim **ya no necesita volver a iniciar sesion**: el propio cambio de vista actualiza la cookie.
- **Como se vuelve a administrador**: eligiendo Administrador en el mismo control, que envia `role: "ADMIN"` y borra la cookie. Si algo falla, basta con borrar `ap_dev_view` en el navegador o cerrar sesion: el logout la borra tambien.
- **Auditoria**: cada cambio de vista deja un `AuditLog` con `action = "DEV_VIEW_SWITCH"`, `userId` y `entityId` del desarrollador y `metadata = { role }`.
- **Atribucion**: como la sesion nunca deja de ser la del desarrollador, lo que se haga desde una vista emulada queda atribuido a **sus** filas de prueba, nunca a un tecnico o a un cliente real.

## Verificacion y pruebas
- `npm run verify`: typecheck (`tsc --noEmit`), lint (`eslint`) y tests unitarios (`vitest run`). Es el mismo conjunto que exige la CI antes del build.
- `npm run test:unit` / `npm run test:watch`: solo Vitest (`tests/unit/**`).
- `npm run test:e2e`: Playwright (`tests/e2e/**`). Necesita una base de datos migrada y sembrada (`npx prisma migrate deploy` y `npm run db:seed`) y las variables de `.env` (`DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `SEED_*`). `playwright.config.ts` levanta `npm run dev` (o `next start` cuando `CI` esta definida) y espera a `/api/health`; con `E2E_BASE_URL` se apunta a un servidor ya levantado. Mas detalles en `tests/e2e/README.md`.
- CI (`.github/workflows/ci.yml`): en cada push a `main` y en cada pull request levanta PostgreSQL 16, ejecuta `prisma generate` y `prisma validate`, `npm run typecheck`, `npm run lint`, `npm run test:unit`, aplica migraciones, siembra datos, hace `npm run build`, instala Chromium y corre `npm run test:e2e`. Si falla, sube `test-results` (trazas y capturas) como artefacto.

## Google Maps keys (importante)
El proyecto usa **dos contextos** para Google Maps:
1. Frontend (autocomplete de direcciones):
   - Variable: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   - Restriccion recomendada: **Websites**
   - Origenes recomendados:
     - `http://localhost:3000/*`
     - `https://tu-dominio.com/*`
     - `https://www.tu-dominio.com/*`
2. Backend (Route Assistant / geocoding server-side):
   - Variable: `GOOGLE_MAPS_SERVER_API_KEY` (o `GOOGLE_MAPS_API_KEY` como alias)
   - Restriccion recomendada: **IP addresses** (solo si tu hosting tiene IP(s) de salida fijas)
   - Si tu hosting cambia IP de salida, usa temporalmente `None` + **API restrictions** estrictas.

### APIs que debes habilitar en Google Cloud
- Maps JavaScript API (frontend autocomplete)
- Places API (frontend autocomplete)
- Geocoding API (Route Assistant backend)

### Seguridad
- No reutilices la misma key para frontend y backend.
- Si una key fue compartida por captura o chat, **rotala**.

## Scripts utiles
- `npm run dev` / `npm run build` / `npm run start`
- `npm run verify`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:studio`
- `npm run db:create-admin`
- `npm run db:seed`
- `npm run worker:cron` (`npm run worker:cron -- --once` ejecuta cada tarea una vez y sale)

## Credenciales demo (seed)
- Admin: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
- Tech: `SEED_TECH_EMAIL` / `SEED_TECH_PASSWORD`
- Customer: `SEED_CUSTOMER_EMAIL` / `SEED_CUSTOMER_PASSWORD`

## Documentacion
- `docs/PRD.md`
- `docs/Scope-V1.md`
- `docs/Architecture.md`
- `docs/DataModel.md`
- `docs/Backlog.md`
- `tests/e2e/README.md`

## Storage S3
- Avatares: `uploads/avatars/{userId}/{YYYY}/{MM}/...`
- Fotos de trabajos: `uploads/jobs/{jobId}/{YYYY}/{MM}/...`
- Facturas PDF: `invoices/{YYYY}/{MM}/{customerId}/{invoiceNumber}.pdf`
