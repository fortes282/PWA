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

## GitHub Actions CI

Repo obsahuje workflow `.github/workflows/ci.yml`, který na push / PR spouští:
- install
- lint
- `pnpm -r test`
- production build
- Playwright Chromium smoke suite (`auth` + `pwa`) proti připravenému API + SQLite seed databázi

## Produkční deployment (Docker Compose)

```bash
# 1. Nastavení env
cp .env.example .env
# Upravte .env: JWT_SECRET, ALLOWED_ORIGINS, NEXT_PUBLIC_API_URL, SMTP_*, VAPID_*

# 2. Generování VAPID klíčů (Web Push)
npx web-push generate-vapid-keys

# 3. Spuštění
docker compose up -d

# Databáze (první spuštění)
docker compose exec api node dist/db/migrate.js
docker compose exec api node dist/db/seed.js
```

Aplikace je dostupná na `http://localhost` (nginx → web:3000, /api → api:3001).

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
