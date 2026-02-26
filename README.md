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
