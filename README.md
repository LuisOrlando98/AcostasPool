# AcostasPool Service Administration System

Plataforma web para administracion de servicios a piscinas: rutas, evidencias e invoices.

## Requisitos
- Node.js 20+
- PostgreSQL (local para V1)

## Configuracion rapida
1. Copia `.env.example` a `.env` y ajusta valores.
2. Instala dependencias:

```bash
npm install
```

3. Genera el cliente de Prisma:

```bash
npm run db:generate
```

4. Aplica el esquema a la base de datos:

```bash
npm run db:push
```

5. Crea el usuario admin inicial:

```bash
npm run db:seed
```

6. Ejecuta el servidor:

```bash
npm run dev
```

Abre `http://localhost:3000`.

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
- `npm run db:push`
- `npm run db:migrate`
- `npm run db:studio`
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

## Deploy en Render
1. Crea servicios con `render.yaml` (web + postgres).
2. Configura variables:
   - `AUTH_SECRET`
   - `APP_URL`
   - `STORAGE_DRIVER=s3`
   - `AWS_REGION`
   - `AWS_S3_BUCKET`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `NEXT_PUBLIC_CDN_URL`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
3. Haz deploy y valida subida de avatar, fotos y PDFs.
