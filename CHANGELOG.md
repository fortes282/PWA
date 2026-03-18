# Changelog

Všechny změny v projektu Přístav Radosti v2.

## [2.9.0] — 2026-03-18

### API Keys & External Integrations (NOC 29)
- **API key management** — `POST /admin/api-keys` creates keys (prefix `pr_live_`, SHA-256 hashed storage), `GET /admin/api-keys` lists keys, `DELETE /admin/api-keys/:id` revokes keys
- **API key authentication** — `X-API-Key` header as alternative to JWT, with expiry checking and last-used tracking
- **Admin API keys page** — `/admin/api-keys` with create form (name, expiry), copy-to-clipboard, key list with revoke
- **Database** — `api_keys` table with hash index
- **Navigation** — "API klíče" link in admin sidebar
- **Testy** — `noc29-features.test.ts` (9 testů): key CRUD, key auth, revocation, access control, version
- **Version bump** → 2.9.0

## [2.8.0] — 2026-03-18

### Security & Session Management (NOC 28)
- **Login history tracking** — every login attempt (success + failed) recorded with IP, user agent, timestamp
- **Login history API** — `GET /login-history` (own history), `GET /admin/login-history` (all, ADMIN only) with filtering by userId and success
- **Active sessions management** — `GET /admin/active-sessions` lists all active refresh tokens with user info
- **Session revocation** — `DELETE /admin/active-sessions/:id` revokes single session, `DELETE /admin/active-sessions/user/:userId` revokes all sessions for a user
- **Admin sessions page** — `/admin/sessions` with tabs: active sessions (real-time list, revoke button), login history (last 100 entries, success/failure, IP, browser)
- **Navigation** — "Relace" link in admin sidebar
- **Database** — `login_history` table with indexes
- **E2E testy NOC 26-27** — `noc26-27-features.spec.ts`: admin dashboard, activity feed, quick summary, notifications, Prometheus metrics, backup auth
- **Testy** — `noc28-features.test.ts` (11 testů): login history CRUD, admin history, active sessions, session revocation, version
- **Version bump** → 2.8.0

## [2.7.0] — 2026-03-18

### Production Hardening & Monitoring (NOC 27)
- **Environment validation** — startup check for required env vars (JWT_SECRET, JWT_REFRESH_SECRET), warns on short/default secrets, checks recommended vars (SMTP, SMS, VAPID, FIO)
- **Prometheus metrics** — `GET /metrics` endpoint with Prometheus text format (request counters, duration histograms, memory usage, uptime)
- **JSON metrics** — `GET /health/metrics` endpoint with JSON summary (top routes, active requests, memory)
- **Metrics collection hooks** — automatic request duration tracking, route normalization, active request counting
- **Database backup API** — `POST /admin/backup` creates timestamped SQLite backup with rotation (max 30), `GET /admin/backups` lists existing backups (ADMIN only)
- **Nginx rate limiting** — login endpoint: 5 req/s, API general: 30 req/s with burst handling
- **Admin monitoring dashboard** — `/admin/monitoring` page with live metrics, memory visualization, top routes table, auto-refresh
- **Navigation** — "Monitoring" link in admin sidebar
- **Admin monitoring page** — `/admin/monitoring` with live system overview: uptime, total requests, memory (RSS/heap), database status with table stats, top routes by traffic, backup management UI, active requests + error counters, auto-refresh every 30s, full dark mode support
- **Database backup UI** — create backups with one click, view backup history (name, size, date), rotation (max 30)
- **E2E testy NOC 26-27** — `noc26-27-features.spec.ts`: admin dashboard, activity feed API, quick summary API, notifications filtering, Prometheus metrics, JSON metrics, backup auth, health version, health/detailed
- **Testy** — `noc27-features.test.ts` (10 testů): env validation, metrics endpoints, backup auth, version
- **Version bump** → 2.7.0

## [2.6.0] — 2026-03-18

### Admin Dashboard & Monitoring (NOC 26)
- **Activity feed** — real-time combined feed from appointments, new users, and audit log (`GET /stats/activity-feed`)
- **Quick summary** — today's appointments, revenue, upcoming 2h, pending actions (`GET /stats/quick-summary`)
- **Admin dashboard redesign** — quick summary widget, activity feed panel, dark mode support
- **Notification filtering** — `GET /notifications` now supports `?type=`, `?unread=true`, `?limit=`, `?offset=` query params
- **Notification response format** — returns `{ notifications, total }` object instead of plain array
- **E2E tests NOC 24-25** — `noc24-25-features.spec.ts` covering account lockout, password strength, skip-to-content, dark mode, breadcrumbs, keyboard shortcuts
- **Testy** — `noc26-features.test.ts` (9 testů): version, activity feed, quick summary, notifications filtering
- **Version bump** → 2.6.0

## [2.5.0] — 2026-03-18

### Dark Mode & UX Polish (NOC 25)
- **Dark mode** — system preference detection + manual toggle (light/dark/system) with localStorage persistence
- **ThemeProvider** — React context with FOUC prevention (inline `<script>` in `<head>`)
- **ThemeToggle** component — 3-state switcher (sun/moon/monitor) in sidebar + mobile header
- **Tailwind `darkMode: "class"`** — all component classes updated with `dark:` variants
- **Breadcrumbs** navigation — automatic path-based breadcrumbs with Czech labels, displayed on all inner pages
- **DataTable** reusable component — sortable columns, client-side search, pagination, dark mode support
- **Keyboard shortcuts** — `Cmd/Ctrl+K` focuses global search, `Escape` closes mobile menu
- **`useKeyboardShortcuts` hook** — reusable keyboard shortcut registration utility
- **Dark mode on all core components** — Layout, GlobalSearch, NotificationBell, CSS component classes (`.card`, `.input`, `.btn-secondary`, `.label`, badges)
- **Testy** — `noc25-features.test.ts` (6 testů): version checks, search endpoint, Swagger docs
- **Version bump** → 2.5.0

## [2.4.0] — 2026-03-18

### Security Hardening (NOC 24)
- **Password hashing upgrade** — scrypt (Node.js native) replaces SHA-256, transparent auto-upgrade on login
- **Account lockout** — 5 failed attempts → 15-minute lockout per email (in-memory tracker)
- **Password strength validation** — minimum 8 chars, uppercase, lowercase, digit — enforced on user creation + password change
- **Configurable rate limits** — `LOGIN_RATE_MAX` env var for in-memory rate limiter
- **Accessibility** — skip-to-content link, aria-labels on sidebar/mobile nav, `aria-expanded` on menu toggle, semantic `<nav>` for mobile menu
- **E2E tests** — `noc20-23-features.spec.ts` covering error handling, health, Swagger, compression, lockout
- **Testy** — `security.test.ts` (9 testů), `account-lockout.test.ts` (2 testy), `hash-upgrade.test.ts` (1 test)
- **Version bump** → 2.4.0

## [2.3.0] — 2026-03-18

### Performance & Hardening (NOC 23)
- **35+ database indexes** — pokrývají všechny hot-query paths (appointments, notifications, invoices, messages, ratings, audit log atd.)
- **Gzip/Brotli komprese** — `@fastify/compress` pro všechny API odpovědi >1KB (~70% menší payloady)
- **Cache headers** — `Cache-Control` pro statické endpointy (/services, /rooms, /packages, /docs)
- **Input sanitization utilities** — `escapeHtml`, `sanitizeText`, `sanitizeMultiline`, `normalizeEmail`, `sanitizePhone`, `clampPagination`
- **Frontend komponenty** — `LoadingSkeleton` (řádky, karty, tabulky), `ErrorBoundary` s retry, `Toast` notification systém, `useApiMutation` hook
- **Testy** — `sanitize.test.ts` (14 testů), `db-indexes.test.ts` (5 testů)
- **Version bump** → 2.3.0

## [2.2.0] — 2026-03-18

### Added
- **Swagger API dokumentace** — `/docs` nyní zobrazuje plně dokumentované API endpointy
- OpenAPI JSON schemas pro 50+ route handlerů: Auth, Appointments, Users, Services, Rooms, Invoices, Credits, Notifications, Waitlist, Messages, Ratings, Export, Reports, Booking Public, Packages, Auto-Processor, Loyalty, Recommendations, iCal, System Health
- `zod-to-json-schema` — automatická konverze sdílených Zod schémat do OpenAPI 3.0
- Centralizovaný soubor `swagger-schemas.ts` s přehlednou organizací dle domén

### Changed
- Verze API zvýšena na 2.2.0
- Route handlery obohaceny o `{ schema: ... }` — Fastify validuje body automaticky

## [2.1.0] — 2026-03-18

### Changed
- Verze API zvýšena na 2.1.0
- Lint cleanup: 0 warningů (ESLint + TypeScript)
- Avatar obrázky používají `next/image` s `unoptimized` (dynamické API URL)
- `useEffect` dependencies opraveny v admin/background audit log

### Previous (2.0.0)

#### NOC 20 — Production Hardening & Deployment
- Graceful shutdown (SIGTERM/SIGINT) pro Docker
- Global error handler: strukturované JSON chybové odpovědi
- Request tracing: `x-request-id` header propagace
- Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- Docker Compose staging overlay (HTTP-only)
- DEPLOY.md — kompletní deployment průvodce
- Swagger API dokumentace na `/docs`

#### NOC 19 — Service Packages, Public Booking, E2E testy
- Service packages CRUD + purchase flow
- Public online booking (bez auth)
- E2E testy pro NOC 18 + 19 features

#### NOC 18 — Recurring Appointments, CSV Export, Reports
- Recurring appointments (WEEKLY/BIWEEKLY/MONTHLY)
- CSV export (klienti, termíny, faktury)
- Monthly revenue + weekly occupancy reports
- Frontend: export záložka, reporty s grafy

#### NOC 17 — Auto-Processor Cron, Notification Prefs, Audit Log UI
- node-schedule: no-show (02:00), invoice-overdue (03:00)
- Notification preferences API + UI
- Admin audit log záložka

#### NOC 16 — Messages, Ratings, Staff Notes, Timeline, Recommendations, iCal
- Direct messages (inbox, sent, replies, contacts)
- Appointment ratings (1-5 hvězd, leaderboard)
- Staff client notes (veřejné + privátní)
- Client timeline (chronologická osa událostí)
- Auto-processor (no-shows, invoice overdue)
- Smart recommendations (rebooking, at-risk, loyalty rewards)
- iCal export (RFC 5545)
- Employee clients + stats

#### NOC 15 — Reminders, Waitlist, Loyalty, Templates, Health Goals
- SMS + email reminders
- Waitlist auto-fill s notifikacemi
- Loyalty points system (balance, leaderboard)
- Appointment templates
- Client health goals
- Admin system health monitor rozšíření

#### NOC 8–14
- Viz git history pro detailní changelog starších nocí
