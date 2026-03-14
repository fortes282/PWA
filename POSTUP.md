# POSTUP.md — Pristav Radosti v2

## Aktuální stav (2026-03-14, noc 5 — session 2 / ~22:15)

### ✅ Kompletní featury

**Backend API (Fastify + SQLite/Drizzle)**
- JWT auth (access 15m + refresh 7d), bcryptjs, per-route rate limiting (auth: 10/min)
- Helmet security headers (X-Frame-Options, HSTS, etc.)
- Users CRUD (admin), roles: ADMIN, RECEPTION, EMPLOYEE, CLIENT
- Services & Rooms CRUD (admin only)
- Working hours (PUT bulk per employee, PATCH single entry, GET by employee)
- Appointments full lifecycle (PENDING→CONFIRMED→COMPLETED/NO_SHOW/CANCELLED)
  - Booking activation flow (reception must activate)
  - Auto-credit deduction on COMPLETED
  - Behavior score tracking (ON_TIME, NO_SHOW, LATE_CANCEL, TIMELY_CANCEL)
  - Auto-invoice creation when credit goes negative
  - Waitlist notification on cancellation
  - **Appointment reschedule** via PATCH (startTime/endTime)
- Waitlist (submit, list, status change, cancel)
- Credit system (balance, transactions, adjust by admin, history)
- **Credit requests** (client submits → reception/admin approves/rejects → credit auto-added)
- Invoices (create with items, status lifecycle: DRAFT→SENT→PAID, notes)
- FIO Bank matching (manual import, auto-match by variable symbol, manual match/unmatch)
- Medical reports (create by employee/admin, edit, list per role, PDF + DOCX export)
- Health records (upsert by employee/admin, read by client)
- Profile change log
- Notifications (in-app, read/unread, mark read, delete)
- Real email (Nodemailer) + **Real SMS via SMSAPI.com** (`SMSAPI_TOKEN` env var) + Web Push (VAPID)
- Appointment reminders: GET /reminders/upcoming, POST /reminders/run
- **Auto-reminder scheduler** (built-in hourly setInterval, runs 1 min after server start)
- Stats endpoint (totalAppts, revenue, noShowRate, topServices, topEmployees, occupancyByDay)
- System settings (key-value store for admin)
- SQLite backup script (data/backup.sh) + Docker Compose + Nginx reverse proxy
- Health endpoint (GET /health) for Docker healthcheck

**Frontend (Next.js 15 + TailwindCSS)**
- Login / Logout / JWT auto-refresh
- Client dashboard: kredit, next appointment, notifications, credit request badge
- Client booking: vybrat službu/terapeuta/čas, koupit kredit
- Client appointments history
- Client waitlist
- **Client credit request** (submit, view status, cancel pending)
- Client health record (view + edit)
- Client progress (behavior score history)
- Reception dashboard: today stats, pending activation, credit requests badge
- Reception appointments: filters, activate, confirm, complete, no-show, cancel, **reschedule**
- **Reception daily schedule timeline** (`/reception/schedule`) — day view 07:00–20:00, day switching, daily revenue, status colors
- Reception clients list + profile
- Reception billing (invoices)
- Reception waitlist management
- **Reception credit requests** (approve/reject with review note)
- Reception working hours management
- Employee dashboard
- Employee appointments
- Employee medical reports: **create + edit + download PDF/DOCX**
- Admin dashboard
- Admin users CRUD
- Admin services CRUD
- Admin rooms CRUD
- Admin stats dashboard (charts, top services, employees)
- Admin FIO matching
- Admin settings
- GitHub Actions CI (`.github/workflows/ci.yml`) pro lint + test + build + Playwright Chromium smoke

**Test coverage (157 tests, 16 test files)**
- auth: login, refresh, logout, role guard
- users: CRUD, profile log, behavior score
- appointments: full lifecycle (11 tests)
- notifications: send, read, delete
- health-records: upsert, RBAC
- credit-requests: submit, approve, reject, cancel (10 tests)
- working-hours: RBAC, bulk PUT, PATCH (10 tests)
- fio: list, add, auto-match, manual match, unmatch, summary (9 tests)
- stats: RBAC, structure, filtering (8 tests)
- reminders: RBAC, upcoming, run (6 tests)
- invoices: create, list, get, status, paid (9 tests)
- waitlist: submit, list, status, cancel (6 tests)
- services-rooms: CRUD, RBAC (10 tests)
- medical: create, list, edit, RBAC (8 tests)
- credits: balance, adjust, RBAC (7 tests)

### ✅ Nové v této session (noc 5 / session 2)
- **Playwright E2E suite rozšířena na 55 testů (55/55 ✅)**
  - Přidány testy pro: client, reception, admin, employee, notifications, settings
  - Opraveny selektory vůči aktuálnímu UI:
    - `employee.spec.ts`: strict mode `.first()` pro timeline hodin
    - `notifications.spec.ts`: `header` (md:hidden) → `button[aria-label="Notifikace"]`
    - `reception.spec.ts`: SWR loading timeout zvýšen na 15 s
    - `settings.spec.ts`: oprava emailu (`klient@pristav.cz`), `.first()` pro strict mode
  - Přidáno `htmlFor`/`id` do settings form a employee reports form (lepší accessibility)
  - `test:e2e:ci` rozšířen o všechny 8 spec souborů
- **VAPID keys** — vygenerovány ukázkové klíče, zapsány do `.env.example` s instrukcí
- **ZADANI.md** — aktualizovány checkboxy (57/60 hotovo, zbývá: real push E2E, real email, real SMS)

### ⚠️ Bloky (čeká na uživatele)
1. ~~**SMS (SMSAPI.com)**~~ — ✅ **HOTOVO** — reálná integrace SMSAPI.com (`SMSAPI_TOKEN`). Sender name `SMSAPI_SENDER` musí být pre-approved v SMSAPI účtu (ECO SMS bez senderu funguje hned).
2. **FIO auto-sync** — `GET /fio/sync` by volal FIO API přímo. Chybí `FIO_API_KEY`. Ruční import funguje.
3. **Real push E2E** — VAPID klíče vygenerovány v `.env.example`. Pro reálný test potřeba VAPID páry nasadit na server a ověřit ServiceWorker end-to-end.
4. **Real email** — Nodemailer připraven, potřeba `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`.

### 📊 Metriky
- API routes: 40+
- Frontend pages: 37+
- Integration tests: 170 (17 test files — přidán sms.test.ts), **0 selhání**
- Root tests: `pnpm -r test` — **✅ bez chyb**
- Build: `NEXT_PUBLIC_API_URL=http://127.0.0.1:3001 pnpm -r build` — **✅ bez chyb**
- Lint: `pnpm -r lint` — **✅ bez varování**
- **Playwright: 55/55 testů ✅** (auth, pwa, client, reception, admin, employee, notifications, settings)
- CI smoke suite (`test:e2e:ci`): všech 8 spec souborů

### 🔒 Bezpečnost
- Per-IP rate limit: 100 req/min globálně, 10 req/min na login
- Rate limits jsou nově konfigurovatelné přes env (`RATE_LIMIT_MAX`, `AUTH_LOGIN_RATE_LIMIT_MAX`, `AUTH_REFRESH_RATE_LIMIT_MAX`) pro CI / test prostředí
- Helmet security headers aktivní
- CORS allowlist (env ALLOWED_ORIGINS)
- JWT + refresh token v HttpOnly cookie
- Bcrypt password hashing (cost 10)

### 🚀 Deployment
- Docker Compose: `api` + `web` + `nginx` (reverse proxy)
- Health check: `GET /health` → returns `{status:"ok"}`
- Auto-reminder scheduler spouští se s API serverem (hourly, 24h okno)
- SQLite backup: `data/backup.sh` + `BACKUP_KEEP_DAYS=14`
- `.env.example` — kompletní šablona pro produkční nasazení

## Noc 5 — dokončeno v tomto resume
1. **Opraven test split** — `apps/web` dostalo vlastní `vitest.config.ts`, takže `pnpm -r test` už nepohlcuje Playwright E2E soubory.
2. **Doplněna GitHub Actions CI** — install + lint + `pnpm -r test` + build + Playwright Chromium smoke.
3. **Opraven seed/migrate drift** — seed byl sladěn s aktuálním schématem (`rooms`, `behavior_events`, `waitlist`).
4. **Zkonfigurovány rate limits pro CI** — přes env lze navýšit limity pro login/refresh a odstranit falešné 429 při E2E běhu.
5. **Aktualizován README + POSTUP** podle reálného stavu.

## Další doporučený krok
1. **Rozšířit Playwright smoke z `auth + pwa` na další stabilní role stránky** (client/reception/admin) po srovnání zastaralých selectorů s aktuálním UI.
2. **Vygenerovat VAPID keys** pro push notifikace.
3. **Nastavit SMSAPI_TOKEN** pro SMS.
4. **FIO auto-sync cron** (pokud dostaneme API key).
5. **Staging deployment** na VPS/Railway pro UAT.
