# POSTUP.md — Pristav Radosti v2

## Aktuální stav (2026-03-16, noc 7 — session 1 / ~02:05)

### ✅ PROJEKT KOMPLETNÍ — všechny ZADANI.md checkboxy splněny (60/60)

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
- Real email (Nodemailer) + **Real SMS via SMSAPI.com** (`SMSAPI_TOKEN` env var) + **Web Push (VAPID)**
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

**Test coverage (190 tests, 19 test files)**
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
- push: subscribe, unsubscribe, test endpoint, DB persistence (push.test.ts)
- push-vapid: VAPID-configured paths, sendPushNotification helper (push-vapid.test.ts)
- sms: SMSAPI.com integration (13 tests)

### ✅ Noc 7 — Dokončeno

**Push notifikace (end-to-end) — HOTOVO ✅**
- Opravena architektura `push.ts`: `vapidConfigured` byl module-level flag → nahrazen lazy `isVapidConfigured()` funkcí
- Testy nyní prochází v obou módech (s VAPID env vars i bez nich): **190/190 ✅**
- `pnpm -r lint` → ✅
- `pnpm -r build` → ✅
- Commit + push: `fix(push): lazy VAPID init — isVapidConfigured() reads env per-call`
- **ZADANI.md: 60/60 checkboxů zaškrtnuto ✅**

### 📊 Finální metriky
- API routes: 40+
- Frontend pages: 37+
- Integration tests: **190 testů / 19 test files**, **0 selhání**
- Playwright E2E: **55 testů ✅** (auth, pwa, client, reception, admin, employee, notifications, settings)
- Settings E2E (push): **14/14 ✅**
- Build: ✅ | Lint: ✅ | Tests: ✅

### ⚠️ Bloky (čeká na uživatele)
1. **FIO auto-sync** — `GET /fio/sync` by volal FIO API přímo. Chybí `FIO_API_KEY`. Ruční import funguje.
2. **Plně reálné push delivery** — subscription flow, unsubscribe, self-test endpoint jsou dotažené. Chybí poslední produkční krok: nasadit skutečné VAPID klíče na server + ověřit doručení v opravdovém browseru/zařízení.
3. **Staging deployment** — Docker Compose je připraven, ale VPS/Railway prostředí zatím nenasazeno.

### 🚀 Deployment ready
- Docker Compose: `api` + `web` + `nginx` (reverse proxy)
- Health check: `GET /health` → returns `{status:"ok"}`
- Auto-reminder scheduler spouští se s API serverem (hourly, 24h okno)
- SQLite backup: `data/backup.sh` + `BACKUP_KEEP_DAYS=14`
- `.env.example` — kompletní šablona pro produkční nasazení (incl. SMTP, SMSAPI, VAPID)

## Doporučené další kroky (post-completion)
1. **Staging deployment** na VPS/Railway pro UAT s uživateli
2. **FIO auto-sync cron** (pokud dostaneme API key)
3. **Plná push delivery validace** — nasadit VAPID keys a ověřit browser delivery live
