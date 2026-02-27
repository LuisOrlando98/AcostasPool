# AcostasPool Service Administration System

Plataforma web para administracion de servicios a piscinas: rutas, evidencias e invoices.

## Modo de trabajo
Este proyecto esta configurado para ejecutar pruebas y despliegues en Render.

## Deploy en Render
1. Crea servicios con `render.yaml` (web + postgres).
2. Define estas variables en el servicio web:
   - `AUTH_SECRET`
   - `APP_URL`
   - `STORAGE_DRIVER` (`local` o `s3`)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
3. Si activas S3, agrega:
   - `AWS_REGION`
   - `AWS_S3_BUCKET`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `NEXT_PUBLIC_CDN_URL`
4. Haz deploy y valida:
   - `GET /api/health`
   - `GET /api/health/db`

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

## Variables de entorno
- `DATABASE_URL`
- `AUTH_SECRET`
- `APP_URL`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `GOOGLE_MAPS_SERVER_API_KEY`
- `GOOGLE_MAPS_API_KEY` (alias opcional)
- `STORAGE_DRIVER` (`local` o `s3`)
- `NEXT_PUBLIC_CDN_URL`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`
- `SEED_TECH_EMAIL`
- `SEED_TECH_PASSWORD`
- `SEED_CUSTOMER_EMAIL`
- `SEED_CUSTOMER_PASSWORD`

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
- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:studio`
- `npm run db:create-admin`
- `npm run db:seed`

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

## Storage S3
- Avatares: `uploads/avatars/{userId}/{YYYY}/{MM}/...`
- Fotos de trabajos: `uploads/jobs/{jobId}/{YYYY}/{MM}/...`
- Facturas PDF: `invoices/{YYYY}/{MM}/{customerId}/{invoiceNumber}.pdf`
