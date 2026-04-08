# Pristav Radosti -- Neurorehabilitacni centrum

PWA klientsky portal pro neurologickou rehabilitaci. Monorepo (pnpm workspaces).

## Stack

| Vrstva | Technologie |
|--------|-------------|
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Backend | Fastify 4, TypeScript |
| DB | PostgreSQL (produkce) / SQLite (dev fallback), Drizzle ORM |
| Auth | JWT (access 15 min + refresh 7 d httpOnly cookie), TOTP 2FA |
| PWA | Service Worker, Web App Manifest, Web Push (VAPID) |
| Testy | Vitest (unit/integration), Playwright (E2E), Lighthouse CI |
| CI | GitHub Actions (lint, test, build, E2E, Lighthouse) |
| Deploy | Docker Compose + nginx reverse proxy |

## Vyvojove prostredi

```bash
# 1. Install
pnpm install

# 2. Databaze
pnpm -C apps/api run db:migrate
pnpm -C apps/api run db:seed

# 3. Spusteni
pnpm dev          # obe aplikace najednou

# nebo separatne:
pnpm -C apps/api dev    # API na :3001
pnpm -C apps/web dev    # Web na :3000
```

## Demo ucty (seed data)

| Role | Email | Heslo |
|------|-------|-------|
| Admin | admin@pristav.cz | Admin123! |
| Recepce | recepce@pristav.cz | Recepce123! |
| Terapeut | terapeut@pristav.cz | Terapeut123! |
| Klient | klient@pristav.cz | Klient123! |

## Testovani

```bash
# API integration testy
pnpm -C apps/api test

# Web: Vitest (komponenty / logika)
pnpm -C apps/web test

# Priprava DB pro E2E (SQLite schema + seed)
pnpm -C apps/web run test:e2e:prepare

# Playwright E2E (main-user-flow.spec.ts, Chromium)
pnpm -C apps/web test:e2e

# Totez s pripravou DB v jednom prikazu
pnpm -C apps/web run test:e2e:local

# E2E s headless=false (pro debugging)
pnpm -C apps/web test:e2e:headed

# Lighthouse CI (po buildu)
pnpm -C apps/web build && pnpm -C apps/web run test:lhci
```

Prehled testu: **[TEST_STACK.md](./TEST_STACK.md)**

## GitHub Actions CI

Workflow [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) na push do `main` a PR:

1. Install + build shared package
2. Lint (TypeScript + ESLint)
3. Unit + integration testy (Vitest)
4. Production build
5. Playwright E2E (`main-user-flow.spec.ts`)
6. Lighthouse CI

Dalsi workflows: `deploy-smoke.yml`, `deploy-vps.yml`, `public-health-monitor.yml`.

## Produkcni deployment (Docker Compose)

Detailni pruvodce: **[DEPLOY.md](./DEPLOY.md)**

```bash
# 1. Nastaveni env
cp .env.example .env.production
# Upravte: JWT_SECRET, ALLOWED_ORIGINS, NEXT_PUBLIC_API_URL, POSTGRES_*, SMTP_*, VAPID_*

# 2. Generovani VAPID klicu (Web Push)
npx web-push generate-vapid-keys

# 3a. Staging (HTTP-only)
docker compose -f docker-compose.yml -f docker-compose.staging.yml \
  --env-file .env.production up -d --build

# 3b. Production (HTTPS)
docker compose --env-file .env.production up -d --build

# Databaze (prvni spusteni)
docker compose exec api node dist/db/migrate.js
docker compose exec api node dist/db/seed.js
```

Aplikace je dostupna na `http://localhost` (nginx -> web:3000, /api -> api:3001).

## Post-deploy smoke a monitoring

```bash
# Rychly smoke check
BASE_URL=https://staging.pristav-radosti.cz pnpm smoke:staging

# Plna verifikace vcetne admin loginu
pnpm smoke:verify \
  --base-url=https://staging.pristav-radosti.cz \
  --admin-email=admin@pristav.cz \
  --admin-password='***'

# Health monitoring (vhodne pro cron)
BASE_URL=https://pristav-radosti.cz pnpm monitor:health

# Lokalni overeni
BASE_URL=http://127.0.0.1:3000 \
API_URL=http://127.0.0.1:3001 \
ADMIN_EMAIL=admin@pristav.cz \
ADMIN_PASSWORD=Admin123! \
pnpm smoke:verify -- --allow-http
```

## Zaloha databaze

```bash
# Manualni zaloha
docker compose exec api sh /app/scripts/backup.sh

# Cron
0 3 * * * docker compose -f /path/to/docker-compose.yml exec -T api sh /app/scripts/backup.sh
```

## Architektura

```
apps/
├── api/                # Fastify REST API
│   ├── src/
│   │   ├── db/         # Drizzle schema, migrace, seed, PG migrace
│   │   ├── plugins/    # Auth middleware
│   │   ├── routes/     # 70+ route modulu (viz nize)
│   │   ├── services/   # Email (Nodemailer), push, SMS
│   │   └── __tests__/  # Integration testy (Vitest)
│   └── Dockerfile
│
├── web/                # Next.js 15 frontend
│   ├── src/app/
│   │   ├── admin/      # 31 stranek (dashboard, uzivatele, sluzby,
│   │   │               # mistnosti, statistiky, FIO, GDPR, audit,
│   │   │               # insurance, monitoring, heatmap, ...)
│   │   ├── client/     # 20 stranek (booking, terminy, kredity,
│   │   │               # pokrok, homework, achievements, ...)
│   │   ├── employee/   # 15 stranek (kalendar, klienti, reporty,
│   │   │               # session templates, therapy reports, ...)
│   │   └── reception/  # 15 stranek (kalendar, klienti, billing,
│   │                   # working hours, zdravotni zaznamy, ...)
│   ├── src/components/ # UI: SplashScreen, GlobalSearch, NotificationBell,
│   │                   # PWAInstallBanner, OfflineBanner, DataTable, ...
│   ├── e2e/            # Playwright E2E testy
│   └── Dockerfile
│
packages/
└── shared/             # Zod schemas (auth, appointment, credit,
                        # invoice, notification, room, service,
                        # slot-recovery, user, waitlist)
```

## API -- klicove route moduly

| Kategorie | Moduly |
|-----------|--------|
| Auth & security | auth, totp, api-keys, password-reset, login-history, audit, gdpr |
| Terminy | appointments, booking-v2, booking-public, cancellations, recurrence, appointment-series, appointment-templates, appointment-reschedule, ical |
| Klienti & zdravi | health-records, health-goals, medical, questionnaires, exercise-library, homework, wellbeing, therapy-reports |
| Finance | credits, credit-requests, invoices, billing (fio), insurance, insurance-vouchers |
| Komunikace | notifications, notification-preferences, notification-log, push, messages, reminders |
| Provoz | rooms, services, therapist-services, working-hours, time-off, slot-recovery, intensive-therapy, intensive-blocks |
| Analytika | stats, analytics, dashboard, heatmap, reports, ai-summary, recommendations, gamification, loyalty, ratings |
| System | health (monitoring), users, search, export, pdf, batch, auto-processor, system-settings, video, waitlist, off-peak, timeline, emergency, client-staff-notes, employee-clients, first-visit-followup, session-templates |

## Role a opravneni

| Role | Pristup |
|------|---------|
| `CLIENT` | Booking, vlastni terminy, kredity, zpravy, pokrok, waitlist, zdravotni karta, homework, achievements |
| `RECEPTION` | Terminy, kalendar, klienti, zdravotni zaznamy, billing, waitlist, pracovni hodiny, credit requesty |
| `EMPLOYEE` | Vlastni kalendar, terminy, klienti, lekarske zpravy, kolegove, session templates, therapy reporty |
| `ADMIN` | Vse vyse + uzivatele, sluzby, mistnosti, statistiky, FIO, GDPR, audit, API keys, insurance, monitoring, heatmap |

## Notifikace

- **In-app**: bell icon, polling 30 s, unread badge
- **Email**: Nodemailer SMTP (`SMTP_*` env vars)
- **Web Push**: VAPID (`npx web-push generate-vapid-keys`)
- **SMS**: SMSAPI.com (`SMSAPI_TOKEN`, `SMSAPI_SENDER`)

## Env promenne

Viz `.env.example`. Klicove:

| Promenna | Popis |
|----------|-------|
| `DATABASE_URL` | PostgreSQL connection string (produkce) |
| `POSTGRES_DB/USER/PASSWORD` | PG credentials pro Docker |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | JWT signing keys |
| `HEALTH_DATA_ENCRYPTION_KEY` | Sifrovani zdravotnich dat (64 hex) |
| `ALLOWED_ORIGINS` | CORS whitelist |
| `NEXT_PUBLIC_API_URL` | API URL pro frontend |
| `SMTP_*` | Email SMTP konfigurace |
| `SMSAPI_TOKEN` | SMS notifikace |
| `VAPID_*` | Web Push klice |
| `FIO_API_KEY` | FIO banka integrace |
| `SLOT_RECOVERY_*` | Autonomni slot recovery konfigurace |
