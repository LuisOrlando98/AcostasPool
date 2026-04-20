# AcostasPool — Claude Code Guide

## What this project is
Pool service operations platform for Acosta's Pool (Miami, FL). Admins manage customers, technicians, weekly service plans, daily routes, invoices, and email notifications. Technicians use a PWA to run their daily route. Customers have a read-only portal.

## Stack
- **Framework:** Next.js 16 App Router + React 19 + TypeScript
- **Database:** PostgreSQL via Prisma ORM (schema at `prisma/schema.prisma`)
- **Auth:** JWT in HttpOnly cookies (`jose`), roles: `ADMIN | TECH | CUSTOMER`
- **Email:** Nodemailer (SMTP), templates stored in `SiteSettings.emailTemplates` JSON
- **Realtime:** Pusher (channels for live job-status updates)
- **Storage:** AWS S3 (or local `/public/uploads` in dev). Driver: `STORAGE_DRIVER=local|s3`
- **PDF:** pdf-lib (invoices, service agreements)
- **i18n:** EN + ES via `src/i18n/messages/en.json` and `es.json`
- **Styles:** Tailwind CSS v4
- **Background jobs:** `node-cron` via `scripts/cron-worker.cjs` (separate Render worker)

## Project layout
```
src/
  app/
    admin/          — Admin pages (Server Components + server actions)
    api/            — API routes
    client/         — Customer portal pages
    tech/           — Technician PWA pages
  components/       — Shared React components
  lib/              — Pure business logic (no React)
    auth/           — JWT, session, guards
    jobs/           — Scheduling, capacity, recurring-plan-templates
    routing/        — Route planner, geocoding, travel metrics
    notifications/  — Email bus, digests, Pusher
    customers/      — Formatting, invite, filters
    invoices/       — PDF generation, line items
  i18n/             — Translation hooks and message files
prisma/
  schema.prisma     — Single source of truth for all models
  migrations/       — Applied in order; never edit past migrations
scripts/            — Node CJS scripts (seed, admin creation, cron worker)
docs/               — PRD, Architecture, DataModel, Backlog, Scope-V1
```

## Key domain concepts
- **ServicePlan** — recurring schedule for a customer property (WEEKLY/BIWEEKLY/MONTHLY). Global plans are named "Monday Plan"…"Saturday Plan" and map to `GLOBAL_RECURRING_PLAN_OPTIONS` in `src/lib/jobs/recurring-plan-templates.ts`.
- **Job** — a single service visit materialized from a plan (or created ad-hoc). Statuses: `SCHEDULED → PENDING → ON_THE_WAY → IN_PROGRESS → COMPLETED`.
- **Route Assistant** — admin tool that groups jobs by date, geocodes addresses, and produces optimized stop order per technician. Three strategies: `BALANCED`, `SHORT_DRIVE`, `KEEP_ASSIGNMENTS`.
- **TechDigest** — batched email summary sent to technicians when their route changes (MORNING/MIDDAY/EVENING windows).
- **SiteSettings** — single-row table `id="default"` holding all configurable JSON blobs (email templates, invoice template, social links, route assistant config, compliance content). Cached 300s via `unstable_cache`.

## How server actions work
Pages under `src/app/admin/customers/[id]/page.tsx` define inline `async function` server actions and pass them as props to Client Components. Validation errors currently `return;` silently — always redirect with `customerDetailFeedbackPath(customerId, "feedback-key")` when an action succeeds.

## Adding i18n keys
1. Add the key to **both** `src/i18n/messages/en.json` and `src/i18n/messages/es.json`.
2. In Server Components use `const t = await getTranslations()` from `@/i18n/server`.
3. In Client Components use `const { t } = useI18n()` from `@/i18n/client`.

## Recurring plan rules
- Global plan names are locked strings ("Monday Plan", etc.). Do not rename them — they are used as route group keys across Jobs, ServicePlans, and the Route Assistant.
- `resolveGlobalPlanStartDate` advances the start date to the correct weekday.
- `materializeServicePlanJob` creates the next Job from a plan and queues a TechDigest item.
- When `advancePlan: true` the plan's `nextRunAt` is advanced by frequency.

## Environment variables (required locally)
```
DATABASE_URL
AUTH_SECRET
APP_URL=http://localhost:3000
CRON_SECRET
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY   # frontend autocomplete (Websites restriction)
GOOGLE_MAPS_SERVER_API_KEY         # backend geocoding (IP restriction)
STORAGE_DRIVER=local
```

## Running locally
```bash
npm install
npx prisma migrate dev
npm run db:seed          # creates demo admin/tech/customer
npm run dev              # Next.js dev server
# In a second terminal (optional):
npm run worker:cron      # processes email queue every 2 min
```

## Database migrations
- Never edit past migration files.
- Create new migration: `npx prisma migrate dev --name description`.
- Production: Render runs `npx prisma migrate deploy` as `preDeployCommand`.

## Testing notes
- No automated test suite exists yet (see Backlog). Validate features manually via the dev server.
- For email: set `SMTP_*` vars or use a local mail trap.

## Code style reminders
- No comments unless the WHY is non-obvious.
- No backwards-compat shims for removed code.
- Prefer editing existing files; avoid creating new abstractions.
- Silent `return;` on server-action validation is acceptable only for hard security guards. User-visible failures should redirect with a feedback param or surface an error message.
- The `deleteProperty` action must NOT silently fail when jobs exist — surface the reason to the user.
- Pagination "Prev"/"Next" labels must go through `t()`.

## Deployment (Render)
- Web service + Cron worker + Postgres defined in `render.yaml`.
- S3 vars needed only if `STORAGE_DRIVER=s3`.
- Health endpoints: `GET /api/health` and `GET /api/health/db`.
