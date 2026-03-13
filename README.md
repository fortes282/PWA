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
| Admin | admin@test.cz | Admin123! |
| Recepce | recepce@test.cz | Recepce123! |
| Terapeut | terapeut@test.cz | Terapeut123! |
| Klient | klient@test.cz | Klient123! |

## Testy

```bash
pnpm -C apps/api test       # 25 integration testů
pnpm -r lint                 # TypeScript + ESLint
pnpm -C apps/web build       # Next.js production build (36 stránek)
```

## Testování

```bash
# API integration testy (46 testů)
pnpm -C apps/api test

# E2E smoke testy (Playwright, 26 testů — vyžaduje spuštěný dev server)
pnpm -C apps/web test:e2e

# E2E s headless=false (pro debugging)
pnpm -C apps/web test:e2e:headed
```

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
- **SMS**: FAYN API (připraveno přes `FAYN_API_KEY` env var)
