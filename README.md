# Přístav Radosti — Neurorehabilitační centrum

PWA klientský portál pro neurologickou rehabilitaci. Monorepo (pnpm workspaces).

## Stack

| Vrstva | Technologie |
|--------|-------------|
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Backend | Fastify 4, TypeScript |
| DB | SQLite (better-sqlite3 + Drizzle ORM) |
| Auth | JWT (accessToken 15m + refreshToken 7d v httpOnly cookie) |
| PWA | Service Worker, Web App Manifest, Web Push (VAPID) |
| Deploy | Docker Compose + nginx reverse proxy |

## Vývojové prostředí

```bash
# 1. Install
pnpm install

# 2. Databáze
pnpm -C apps/api run db:migrate
pnpm -C apps/api run db:seed

# 3. Spuštění
pnpm dev          # obě aplikace najednou

# nebo separátně:
pnpm -C apps/api dev    # API na :3001
pnpm -C apps/web dev    # Web na :3000
```

## Demo účty (seed data)

| Role | Email | Heslo |
|------|-------|-------|
| Admin | admin@pristav.cz | Admin123! |
| Recepce | recepce@pristav.cz | Recepce123! |
| Terapeut | terapeut@pristav.cz | Terapeut123! |
| Klient | klient@pristav.cz | Klient123! |

## Testy

```bash
pnpm -r test                                # API integration + web vitest smoke (bez Playwright E2E)
pnpm -r lint                                # TypeScript + ESLint
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001 pnpm -r build
```

## Testování

```bash
# API integration testy
pnpm -C apps/api test

# Kompletní Playwright E2E sada (lokální debugging / rozšiřování)
pnpm -C apps/web test:e2e

# Stabilní CI smoke subset (auth + PWA)
pnpm -C apps/web test:e2e:ci

# E2E s headless=false (pro debugging)
pnpm -C apps/web test:e2e:headed
```

## Security hardening

- Baseline a změny po hardeningu: **[SECURITY_HARDENING_BASELINE.md](./SECURITY_HARDENING_BASELINE.md)**
- Incident response postup: **[SECURITY_INCIDENT_RUNBOOK.md](./SECURITY_INCIDENT_RUNBOOK.md)**
- Rollout a rollback checklist: **[SECURITY_ROLLOUT_CHECKLIST.md](./SECURITY_ROLLOUT_CHECKLIST.md)**

## GitHub Actions CI

Repo obsahuje workflow `.github/workflows/ci.yml`, který na push / PR spouští:
- install
- lint
- `pnpm -r test`
- production build
- Playwright Chromium smoke suite (`auth` + `pwa`) proti připravenému API + SQLite seed databázi

## Post-deploy smoke verification

Po nasazení na staging nebo produkci lze spustit rychlou browserless verifikaci veřejného webu i API:

```bash
pnpm smoke:verify \
  --base-url=https://staging.pristav-radosti.cz \
  --admin-email=admin@pristav.cz \
  --admin-password='***' \
  --expected-version=2.11.0
```

Co kontrola ověří:
- web root + login page
- `manifest.json` a `/offline`
- `/api/health`, `/api/health/ping`, `/api/health/detailed`, `/api/docs`
- admin login přes API
- `GET /auth/me`, `GET /users/me`
- refresh token flow (`POST /auth/refresh`)

Volitelné proměnné prostředí:
- `BASE_URL`, `API_URL` (default API = `<base-url>/api`)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `EXPECTED_VERSION`
- `SMOKE_TIMEOUT_MS`

Repo nově obsahuje i ručně spustitelný GitHub Actions workflow `.github/workflows/deploy-smoke.yml`.
Před prvním použitím nastavte secrets `SMOKE_ADMIN_EMAIL` a `SMOKE_ADMIN_PASSWORD`, pak workflow spusťte přes **Actions → Deploy Smoke Verify** a zadejte `base_url` / volitelně `api_url`.

Pro průběžný veřejný dohled je k dispozici i workflow `.github/workflows/public-health-monitor.yml`:
- běží každých 15 minut přes GitHub Actions scheduler
- lze spustit i ručně přes **Actions → Public Health Monitor**
- očekává repo/environment variable `MONITOR_BASE_URL` (případně manuální input `base_url`)
- volitelné vars: `MONITOR_MAX_DB_LATENCY_MS`, `MONITOR_FAIL_ON_DEGRADED`, `MONITOR_WARN_IF_PENDING_REMINDERS_GT`
- ukládá JSON summary jako artifact `public-health-monitor-summary`

Pro lokální ověření dev prostředí:

```bash
BASE_URL=http://127.0.0.1:3000 \
API_URL=http://127.0.0.1:3001 \
ADMIN_EMAIL=admin@pristav.cz \
ADMIN_PASSWORD=Admin123! \
pnpm smoke:verify -- --allow-http
```

## Produkční deployment (Docker Compose)

Detailní průvodce: **[DEPLOY.md](./DEPLOY.md)**

```bash
# 1. Nastavení env
cp .env.example .env.production
# Upravte: JWT_SECRET, ALLOWED_ORIGINS, NEXT_PUBLIC_API_URL, SMTP_*, VAPID_*

# 2. Generování VAPID klíčů (Web Push)
npx web-push generate-vapid-keys

# 3a. Staging (HTTP-only)
docker compose -f docker-compose.yml -f docker-compose.staging.yml \
  --env-file .env.production up -d --build

# 3b. Production (HTTPS)
docker compose --env-file .env.production up -d --build

# Databáze (první spuštění)
docker compose exec api node dist/db/migrate.js
docker compose exec api node dist/db/seed.js
```

Aplikace je dostupná na `http://localhost` (nginx → web:3000, /api → api:3001).

## Post-deploy smoke & monitoring automation

Rychlý neautentizovaný smoke check běžící proti nasazené instanci:

```bash
BASE_URL=https://staging.pristav-radosti.cz pnpm smoke:staging
```

Co kontroluje:
- `/health`
- `/health/ping`
- `/health/detailed`
- `/docs`
- `/manifest.json`
- `/offline`
- `/login`

Dostupné parametry:

```bash
ALLOW_DEGRADED=1 BASE_URL=https://staging.pristav-radosti.cz pnpm smoke:staging
CURL_TIMEOUT=15 RETRIES=5 RETRY_DELAY=3 BASE_URL=https://staging.pristav-radosti.cz pnpm smoke:staging
```

Hlubší verifikace po deployi včetně admin loginu, `/auth/me`, `/users/me` a refresh token flow:

```bash
BASE_URL=https://staging.pristav-radosti.cz \
API_URL=https://staging.pristav-radosti.cz/api \
ADMIN_EMAIL=admin@pristav.cz \
ADMIN_PASSWORD='***' \
EXPECTED_VERSION=2.11.0 \
pnpm smoke:verify
```

Lehký monitoring helper vhodný pro cron/Nagios-style checks:

```bash
BASE_URL=https://pristav-radosti.cz pnpm monitor:health
```

Pro CI / artifacty umí i JSON výstup:

```bash
MONITOR_JSON=1 BASE_URL=https://pristav-radosti.cz pnpm monitor:health
```

Návratové kódy:
- `0` = OK
- `1` = warning (např. příliš mnoho pending reminders)
- `2` = critical (ping nedostupný, DB neodpovídá, degradace, vysoká DB latence)

## Záloha databáze

```bash
# Manuální záloha
docker compose exec api sh /app/scripts/backup.sh

# Cron (přidat do crontabu)
0 3 * * * docker compose -f /path/to/docker-compose.yml exec -T api sh /app/scripts/backup.sh
```

## Architektura

```
apps/
├── api/          # Fastify REST API
│   ├── src/
│   │   ├── db/           # Drizzle schema + migrations + seed
│   │   ├── plugins/      # Auth middleware
│   │   ├── routes/       # appointments, auth, billing, behavior, credits,
│   │   │                 # fio, health-records, invoices, medical,
│   │   │                 # notifications, pdf (PDF+DOCX export), push,
│   │   │                 # rooms, services, stats, users, waitlist,
│   │   │                 # working-hours
│   │   ├── services/     # email (Nodemailer), push integration
│   │   └── __tests__/    # Integration tests (vitest)
│   └── Dockerfile
│
├── web/          # Next.js 15 frontend
│   ├── src/app/
│   │   ├── admin/        # Dashboard, users, services, rooms, stats,
│   │   │                 # background, fio, settings
│   │   ├── client/       # Dashboard, booking, appointments, credits,
│   │   │                 # reports, progress, waitlist, health-record
│   │   ├── employee/     # Day Timeline (quick status actions), appointments,
│   │   │                 # reports (PDF+DOCX), colleagues
│   │   └── reception/    # Calendar (týden/měsíc, filtr terapeuta),
│   │                     # appointments, clients, health-records, waitlist,
│   │                     # billing, working-hours, invoices
│   ├── src/components/   # Layout, RouteGuard, NotificationBell, SWRegister
│   └── Dockerfile
│
packages/
└── shared/       # Zod schemas pro RBAC a API validaci
```

## Role a oprávnění

| Role | Přístup |
|------|---------|
| `CLIENT` | Booking, vlastní termíny, kredity, zprávy, pokrok, waitlist, zdravotní karta |
| `RECEPTION` | Termíny, kalendář, klienti, zdravotní záznamy, billing, waitlist, pracovní hodiny |
| `EMPLOYEE` | Vlastní kalendář, termíny, lékařské zprávy, kolegové |
| `ADMIN` | Vše výše + uživatelé, služby, místnosti, statistiky, FIO, background |

## Notifikace

- **In-app**: bell icon v sidebaru, polling 30s, unread badge
- **Email**: Nodemailer SMTP (konfigurovat přes `SMTP_*` env vars)
- **Web Push**: VAPID — generovat klíče přes `npx web-push generate-vapid-keys`
- **SMS**: SMSAPI.com (Bearer token přes `SMSAPI_TOKEN` env var, volitelný sender přes `SMSAPI_SENDER`)

## API — klíčové endpointy (přehled)

| Endpoint | Popis |
|----------|-------|
| `GET /health` | Docker healthcheck |
| `GET /health/detailed` | DB ping, feature flags (email/SMS/push/FIO), uptime |
| `GET /dashboard/reception` | Agregovaná data pro reception dashboard (1 volání) |
| `GET /dashboard/client` | Klientský souhrn (balance, nextAppt, stats) |
| `GET /users/me` | Profil aktuálního uživatele |
| `POST /users/:id/reactivate` | Obnovení deaktivovaného uživatele (ADMIN) |
| `GET /users/export/csv` | Export uživatelů jako CSV (ADMIN/RECEPTION) |
| `GET /appointments?status=X,Y&search=&limit=&page=` | Termíny s filtrací a paginací |
| `PATCH /appointments/:id/notes` | Editace poznámek (bez změny statusu) |
| `GET /appointments/:id` | Detail termínu (enriched: clientName, employeeName, serviceName) |
| `GET /credits/history?page=&limit=` | Paginovaná historie kreditů |
| `DELETE /notifications/clear-read` | Smazat přečtené notifikace |
| `GET /fio/export/csv` | Export FIO transakcí jako CSV |
| `GET /services?includeInactive=true` | Všechny služby včetně neaktivních (ADMIN) |
| `GET /stats` | Statistiky + `revenueByMonth` (posledních 12 měsíců) |

## Changelog (noc 7+)

### 2026-03-16 (noc 8)
- `GET /health/detailed` — monitoring endpoint
- `DELETE /notifications/clear-read` — bulk smazání přečtených
- `GET /credits/history` — paginace (page/limit)
- `GET /fio/export/csv` — export FIO transakcí do CSV s BOM
- `GET /users/me` — shortcut aktuálního uživatele
- `POST /users/:id/reactivate` — obnovení deaktivovaného uživatele
- `GET /users/export/csv` — export klientů do CSV
- Appointment booking: conflict check pro klienta (409) + terapeuta (409)
- `GET /appointments`: multi-status filter, notes search, paginace
- `PATCH /appointments/:id/notes` — editace poznámek
- `GET /appointments/:id` — enriched response (clientName, employeeName, serviceName)
- `GET /dashboard/reception` + `GET /dashboard/client` — agregované endpointy
- `appointments.cancellationReason` — důvod zrušení termínu
- `GET /stats` + `revenueByMonth` — výnosy po měsících
- Client Invoices page (`/client/invoices`) — faktury klienta s PDF download
- Admin Stats: nový chart výnosů po měsících
- Seed data: faktury, FIO transakce, credit requests
- DEPLOYMENT.md — kompletní průvodce produkčním nasazením
- nginx: plná HTTPS konfigurace + Certbot ACME + docker-compose Certbot service
- **Testy: 21 souborů / 240 testů ✅**
