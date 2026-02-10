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
