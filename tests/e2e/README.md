# E2E (Playwright)

Smoke suite that boots nothing by itself: it expects a PostgreSQL database reachable
through `DATABASE_URL` (see `.env`) with migrations applied
(`npx prisma migrate deploy`) and seed data (`npm run db:seed`).

## Running

Against the dev server (the config starts `npm run dev` unless something already
listens on `http://localhost:3000`):

```
npm run test:e2e
```

Against a production build (recommended, mirrors the deployed app):

```
npm run build
set -a && . ./.env && set +a && npx next start -p 3100 &
E2E_BASE_URL=http://localhost:3100 npx playwright test
```

If Chromium is missing: `npx playwright install chromium`.

In CI (`CI` set) the config starts `npx next start` on the `baseURL` port instead of
the dev server, so `npm run build` must run first.

## Layout

| File | Purpose |
| --- | --- |
| `helpers/constants.ts` | Seed credentials (`SEED_*` env overrides), role home paths, HTTP codes |
| `helpers/texts.ts` | EN/ES regexes for headings, buttons, labels and feedback messages |
| `helpers/auth.ts` | API login (`POST /api/auth/login`), UI login, per-worker storage-state cache |
| `helpers/fixtures.ts` | `test.use({ role })` loads the seed session; service workers blocked |
| `helpers/assertions.ts` | `gotoOk` (HTTP 200 + no Next.js error UI), heading and JSON helpers |
| `helpers/seed.ts` | Resolves the seed job id via Prisma and reschedules the job to today when stale |
| `public.spec.ts` | Landing, legal, login, offline pages and health endpoints |
| `auth.spec.ts` | UI login per role, invalid credentials, route protection |
| `admin.spec.ts` | Admin pages, seed customer detail, customer/invoice creation, CSV export |
| `tech.spec.ts` | Technician pages and seed job detail |
| `client.spec.ts` | Client portal pages and seed job detail |
| `api.spec.ts` | `/api/auth/me`, `/api/notifications/unread`, `/api/health/db` |

## Notes

- The seed job (`scripts/seed.cjs`) is scheduled at 09:00 of the day the seed ran
  and `/tech` only lists jobs from the start of the current business day. The
  `seedJobId` worker fixture (`helpers/seed.ts`) therefore looks the job up
  through Prisma and moves it to today when it is stale, so the suite does not
  depend on seeding and running on the same day. It needs `DATABASE_URL`: the
  config loads `.env` when the variable is not already set.
- Seeded users are stored with locale `ES`, anonymous visitors get `en`; every text
  assertion accepts both languages.
- One API login per role is cached per worker. A full run performs 7 logins
  (3 API + 4 UI). The login endpoint allows 15 attempts/min per IP and 8 per
  5 min per e-mail, so keep re-runs to about two per minute.
- Write flows leave data behind on purpose: a customer named `E2E Smoke <timestamp>`
  and a `DRAFT` invoice (plus its PDF) for the seed customer.
- `auth.spec.ts` documents with `test.fail` that `?next=` is dropped on the
  `/login` redirect because `middleware.ts` at the project root is not bundled
  (the app lives under `src/`).
