# Arquitectura (V1)

## Stack recomendado
- Frontend/Backend: Next.js (App Router) + TypeScript
- UI: Tailwind CSS
- DB: PostgreSQL + Prisma
- Email: SMTP (Microsoft 365)
- Storage: Local en desarrollo, Cloudflare R2 o AWS S3 en produccion

## Entorno local
- `npm run dev` para levantar la app
- Postgres local (Docker o instalacion nativa)
- Archivos subidos guardados en `/public/uploads`
- Invoices PDF guardadas en `/public/invoices`

## Produccion (futuro)
- Hosting: Vercel, AWS o DigitalOcean
- Archivos: Object Storage (S3/R2)
- DNS y SSL: dominio corporativo con HTTPS
