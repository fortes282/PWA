# Vyvojove prostredi

## Pozadavky

- Node.js >= 20
- pnpm >= 9

## Prvni spusteni

```bash
# 1. Instalace zavislosti
pnpm install

# 2. Shared package (musi se buildnout prvni)
pnpm -C packages/shared build

# 3. Databaze — migrace + seed demo dat
pnpm -C apps/api run db:migrate
pnpm -C apps/api run db:seed

# 4. Spusteni (API :3001 + Web :3000)
pnpm dev
```

Separatni spusteni:
```bash
pnpm -C apps/api dev     # API na http://localhost:3001
pnpm -C apps/web dev     # Web na http://localhost:3000
```

## Demo ucty

| Role | Email | Heslo |
|------|-------|-------|
| Admin | admin@pristav.cz | Admin123! |
| Recepce | recepce@pristav.cz | Recepce123! |
| Terapeut | terapeut@pristav.cz | Terapeut123! |
| Terapeut 2 | terapeut2@pristav.cz | Terapeut123! |
| Klient 1-4 | klient@pristav.cz | Klient123! |

Seed data zahrnuje: 7 sluzeb, 4 mistnosti, pracovni hodiny (Po-Pa 08:00-18:00), 31 terminu, kreditni transakce, notifikace.

## Env promenne

Zkopirujte `.env.example` → `.env` (nebo `.env.production` pro deploy).

### Povinne (produkce)

| Promenna | Popis | Generovani |
|----------|-------|------------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Signing key pro access tokeny | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | Signing key pro refresh tokeny | stejne jako vyse |
| `HEALTH_DATA_ENCRYPTION_KEY` | AES-256-GCM klic pro zdravotni data | 64 hex znaku |
| `ALLOWED_ORIGINS` | CORS whitelist (carkou oddelene) | `https://pristav-radosti.cz` |
| `NEXT_PUBLIC_API_URL` | API URL pro frontend | `https://pristav-radosti.cz/api` |

### Volitelne

| Promenna | Default | Popis |
|----------|---------|-------|
| `JWT_EXPIRES_IN` | `15m` | Expirace access tokenu (s/m/h/d) |
| `AUTH_REFRESH_TOKEN_DAYS` | `30` | Expirace refresh tokenu (dny) |
| `AUTH_LOGIN_RATE_LIMIT_MAX` | `10` | Max login pokusu per IP per okno |
| `AUTH_LOGIN_RATE_LIMIT_WINDOW` | `5 minutes` | Okno pro login rate limit |
| `RATE_LIMIT_MAX` | `100` | Globalni rate limit per min |
| `SMTP_HOST/PORT/USER/PASS` | — | SMTP pro emaily |
| `SMSAPI_TOKEN` | — | SMS notifikace |
| `SMSAPI_SENDER` | `Pristav` | SMS sender ID |
| `VAPID_PUBLIC_KEY/PRIVATE_KEY` | — | Web Push klice (`npx web-push generate-vapid-keys`) |
| `VAPID_SUBJECT` | — | `mailto:` adresa pro VAPID |
| `FIO_API_KEY` | — | FIO banka integrace |
| `REMINDER_HOURS` | `24` | Hodiny pred terminem pro pripominku |
| `SLOT_RECOVERY_ENABLED` | `false` | Autonomni slot recovery |
| `LOG_LEVEL` | `info` | Pino logger level |

### Dev-only

| Promenna | Popis |
|----------|-------|
| `CI=true` | Vypne rate limiting, prodlouzi JWT |
| `JWT_EXPIRES_IN=2h` | Delsi token pro E2E testy |
| `DATABASE_PATH` | Cesta k SQLite (default: `/app/data/pristav.db`) |

## Testovani

### Vitest — unit a integration testy

```bash
# Vsechny testy (API + web)
pnpm -r test

# Jen API testy
pnpm -C apps/api test

# Jen web testy
pnpm -C apps/web test

# Watch mode
pnpm -C apps/web test -- --watch
```

API testy pokryvaji: security-matrix, dashboard, credits, services, working-hours, SMS, timeline, search, reminders, medical, recurrence, system-settings.

Web testy pouzivaji MSW (Mock Service Worker) pro mockovani API.

### Playwright — E2E testy

Jeden hlavni test: `apps/web/e2e/main-user-flow.spec.ts` — pokryva klientsky flow pres celou aplikaci.

```bash
# Priprava DB pro E2E (seed uzivatelu)
pnpm -C apps/web run test:e2e:prepare

# Spusteni E2E (Chromium, headless)
pnpm -C apps/web test:e2e

# Vse v jednom prikazu (priprava + E2E)
pnpm -C apps/web run test:e2e:local

# S viditelnym prohlizecem (debugging)
pnpm -C apps/web test:e2e:headed
```

Konfigurace (`playwright.config.ts`):
- Projekt: Chromium (Desktop Chrome)
- Timeout: 180 s per test
- Retries: 1 v CI, 0 lokalne
- Artefakty pri chybe: screenshot, video, trace
- Automaticky startuje API (:3001) a Next.js (:3000)

Env promenne pro Playwright:
- `BASE_URL` — cilova URL (default `http://localhost:3000`)
- `PW_SKIP_WEBSERVER=1` — nespoustet web server (pouzit existujici)
- `PW_SKIP_API_WEBSERVER=1` — nespoustet API (pouzit existujici)
- `PW_REUSE_WEBSERVER=1` — reuse existujiciho serveru (rychlejsi iterace)

### Lighthouse CI

```bash
# Po buildu
pnpm -C apps/web build
pnpm -C apps/web run test:lhci
```

Konfigurace v `apps/web/lighthouserc.cjs`. Testuje `/login` stranku.

### Lint

```bash
pnpm -r lint
```

TypeScript strict mode + ESLint.

## CI pipeline

GitHub Actions workflow `.github/workflows/ci.yml` na push do `main` a PR:

1. Checkout + pnpm 9 + Node 20 (s cache)
2. `pnpm install --frozen-lockfile`
3. Build shared package
4. Lint (`pnpm -r lint`)
5. Unit + integration testy (`pnpm -r test`)
6. Production build (`pnpm -r build`)
7. Install Playwright Chromium
8. E2E prepare + run
9. Lighthouse CI

Dalsi workflows:
- `deploy-smoke.yml` — manualne spousteny smoke test proti deployi
- `deploy-vps.yml` — deployment na VPS
- `public-health-monitor.yml` — automaticky kazdych 15 min

## Uzitecne prikazy

```bash
# Build vsech balicku
pnpm -r build

# Build jen API
pnpm -C apps/api build

# Build jen web (vyzaduje NEXT_PUBLIC_API_URL)
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001 pnpm -C apps/web build

# Cisteni build artefaktu
pnpm -r clean

# Swagger UI (po spusteni API)
open http://localhost:3001/docs
```

## Struktura kodu — dulezite soubory

| Soubor | Co tam najdete |
|--------|----------------|
| `apps/api/src/server.ts` | Fastify server setup, vsechny pluginy a hooks |
| `apps/api/src/plugins/auth.ts` | JWT + API key autentizace middleware |
| `apps/api/src/db/schema.ts` | Kompletni DB schema (48 tabulek) |
| `apps/api/src/db/seed.ts` | Demo data |
| `apps/web/src/lib/api.ts` | Frontend API klient (apiFetch) |
| `apps/web/src/lib/auth.tsx` | AuthContext, AuthProvider, token management |
| `apps/web/src/components/RouteGuard.tsx` | Frontend route ochrana (role check) |
| `packages/shared/src/index.ts` | Export sdilenych Zod schemas |
