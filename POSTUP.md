# POSTUP.md — Pristav Radosti v2

## NOC 28 — v2.8.0 Security & Session Management

**Testy: 637/67 (všechny zelené) | Lint: 0 warningů | Frontend build: OK | Push: OK**

**1. Login History Tracking**
- Tabulka `login_history` — každý pokus o přihlášení (úspěšný i neúspěšný) s IP, user agent, timestamp
- Automatický záznam v auth route při login (success + failed)
- Index na user_id a created_at

**2. Login History API**
- `GET /login-history` — vlastní historie přihlášení (libovolný autentizovaný uživatel)
- `GET /admin/login-history` — kompletní historie všech uživatelů (ADMIN only)
- Filtry: `?userId=`, `?success=true/false`, `?limit=`

**3. Active Sessions Management**
- `GET /admin/active-sessions` — seznam všech aktivních refresh tokenů s uživatelskými údaji
- `DELETE /admin/active-sessions/:id` — revokace jedné relace
- `DELETE /admin/active-sessions/user/:userId` — revokace všech relací uživatele

**4. Admin Sessions Page**
- `/admin/sessions` — dvě záložky: Aktivní relace + Historie přihlášení
- Aktivní relace: real-time seznam, role badge, čas přihlášení/expirace, tlačítko "Zrušit"
- Historie: posledních 100 přihlášení, success/failure indikátor, IP, prohlížeč
- Dark mode support, auto-refresh 30s

**5. E2E Tests NOC 26-27**
- `noc26-27-features.spec.ts`: admin dashboard, activity feed, quick summary, notification filtering, Prometheus metrics, JSON metrics, backup auth, health version

**6. Version Bump → 2.8.0**
- API Swagger info, health endpoint, health/detailed — všechny na 2.8.0
- Testy aktualizovány pro novou verzi
- CHANGELOG.md aktualizován
- `noc28-features.test.ts`: 11 nových testů

---

## NOC 27 — v2.7.0 Production Monitoring, Env Validation, Metrics, Backup API

**Testy: 626/66 (všechny zelené) | Lint: 0 warningů | Frontend build: OK | Push: OK**

**1. Environment Validation**
- `utils/env-validation.ts` — startup validace: povinné vars (JWT_SECRET, JWT_REFRESH_SECRET), detekce krátkých/defaultních secrets
- Varování pro doporučené vars (SMTP, SMS, VAPID, FIO)
- V produkci odmítne start při chybějících povinných vars

**2. Prometheus Metrics**
- `utils/metrics.ts` — in-memory request counter, duration histogram, active requests, error counter, memory stats
- `GET /metrics` — Prometheus text format (kompatibilní s Grafana/Prometheus stack)
- `GET /health/metrics` — JSON summary pro admin dashboard
- Auto-tracking hooks: onRequest/onResponse měří latenci, normalizuje routes

**3. Database Backup API**
- `utils/backup.ts` — timestamped SQLite backup s rotací (max 30 kopií)
- `POST /admin/backup` — vytvoří zálohu (ADMIN only)
- `GET /admin/backups` — seznam existujících záloh (ADMIN only)

**4. Nginx Rate Limiting**
- Login endpoint: `limit_req_zone` 5 req/s burst 10
- General API: 30 req/s burst 50

**5. Admin Monitoring Dashboard**
- `/admin/monitoring` — live metriky s auto-refresh (10s)
- Karty: uptime, total requests, active, errors
- Vizualizace paměti (heap usage bar)
- Top routes tabulka s barevným avg latency

**6. Version Bump → 2.7.0**
- API Swagger info, health endpoint, health/detailed — všechny na 2.7.0
- Testy aktualizovány pro novou verzi
- CHANGELOG.md aktualizován
- `noc27-features.test.ts`: 10 nových testů (env validation, metrics, backup auth, version)

---

## NOC 26 — v2.6.0 Admin Dashboard, Activity Feed, Notification Filtering

**Testy: 616/65 (všechny zelené) | Lint: 0 warningů | Frontend build: OK | Push: čeká**

**1. Activity Feed API**
- `GET /stats/activity-feed?limit=N` — chronologický feed kombinující termíny (7 dní), nové uživatele (30 dní), audit log (3 dny)
- Každá položka: id, type, title, description, timestamp, userId, userName, icon (emoji)
- ADMIN/RECEPTION only

**2. Quick Summary API**
- `GET /stats/quick-summary` — dnešní přehled: termíny (total/completed/pending/confirmed/cancelled/no-show), výnosy, blížící se (2h), celkem pending
- ADMIN/RECEPTION only, 30s refresh

**3. Admin Dashboard Redesign**
- Nový widget "Dnešní přehled" (QuickSummary) — 4 karty s denním stavem
- Nový panel "Nedávná aktivita" (ActivityFeed) — live feed s emoji ikonami a relativním časem
- Dark mode support na celém dashboard

**4. Notification Filtering**
- `GET /notifications` nyní vrací `{ notifications, total }` místo plain array
- Podpora query parametrů: `?type=`, `?unread=true`, `?limit=`, `?offset=`
- Frontend (NotificationBell, notifications page, client dashboard) aktualizován pro nový formát

**5. E2E Tests NOC 24-25**
- `noc24-25-features.spec.ts`: 7 specifikací — account lockout, password strength, skip-to-content, dark mode toggle, breadcrumbs, Cmd+K shortcut, DataTable, API version

**6. Version Bump → 2.6.0**
- API Swagger info, health endpoint, health/detailed — všechny na 2.6.0
- Testy aktualizovány pro novou verzi
- CHANGELOG.md aktualizován
- `noc26-features.test.ts`: 9 nových testů

---

## NOC 25 — v2.5.0 Dark Mode, UX Polish, Reusable Components

**Testy: 607/64 (všechny zelené) | Lint: 0 warningů | Frontend build: OK | Push: OK**

**1. Dark Mode**
- Tailwind `darkMode: "class"` enabled
- `ThemeProvider` React context — system preference detection + manual override (light/dark/system)
- FOUC prevention: inline `<script>` v `<head>` aplikuje třídu `dark` před hydratací
- `ThemeToggle` component — 3-state switcher (Sun/Moon/Monitor) v sidebar i mobile headeru
- Persistence přes `localStorage("pristav-theme")`
- Listener na `prefers-color-scheme` media query pro automatické přepínání

**2. Dark Mode — Component Updates**
- Layout (sidebar, nav items, user panel, mobile header, mobile nav) — kompletní `dark:` varianty
- GlobalSearch — dark dropdown, dark input, dark results
- NotificationBell — dark dropdown, dark unread badge, dark timestamps
- CSS globals: `.card`, `.input`, `.btn-secondary`, `.label`, všechny `.badge-*` varianty

**3. Breadcrumbs Navigation**
- Automatický breadcrumb z URL path segmentů
- České překlady segmentů (40+ mapování)
- Skrytý na top-level stránkách (1 segment)
- Numerické segmenty zobrazeny jako `#123`
- Integrováno do Layout `<main>`

**4. DataTable Reusable Component**
- Generický `DataTable<T>` s typed columns
- Sortable columns (asc/desc/none) s vizuálními indikátory
- Client-side fulltext search přes libovolné klíče
- Paginace s navigací (strana X z Y, počet záznamů)
- Dark mode support
- Custom render per column, onRowClick handler

**5. Keyboard Shortcuts**
- `Cmd/Ctrl+K` → focus global search input
- `Escape` → zavře mobilní menu
- `useKeyboardShortcuts` hook — reusable, respektuje input elementy

**6. Version Bump → 2.5.0**
- API Swagger info, health endpoint, health/detailed — všechny na 2.5.0
- Testy aktualizovány pro novou verzi
- CHANGELOG.md aktualizován
- `noc25-features.test.ts`: 6 nových testů (verze, search, Swagger)

---

## NOC 24 — v2.4.0 Security Hardening, Accessibility, E2E Tests

**Testy: 601/63 (všechny zelené) | Lint: 0 warningů | Frontend build: OK | Push: OK**

**1. Password Hashing Upgrade (scrypt)**
- Migrace z SHA-256 na scrypt (Node.js native `scryptSync`, N=16384, r=8, p=1)
- Formát: `scrypt:<salt>:<hash>` — zpětná kompatibilita s legacy `salt:hash`
- Transparentní auto-upgrade: při přihlášení se legacy hash automaticky přepíše na scrypt
- `isLegacyHash()` utility pro detekci starých hashů
- `hash-upgrade.test.ts`: 1 test — ověření transparentního upgradu

**2. Account Lockout**
- In-memory tracker per email: 5 neúspěšných pokusů → 15min blokace
- Úspěšné přihlášení resetuje počítadlo
- HTTP 429 s českou zprávou a zbývajícím časem
- `account-lockout.test.ts`: 2 testy

**3. Password Strength Validation**
- `validatePasswordStrength()`: min 8 znaků, velké + malé písmeno + číslice
- Vynuceno při vytváření uživatele i změně hesla
- České chybové hlášky

**4. Configurable Rate Limits**
- `LOGIN_RATE_MAX` env proměnná pro in-memory rate limiter (default 10)
- Umožňuje testování bez rate limit interference

**5. Accessibility (Frontend)**
- Skip-to-content odkaz (`.sr-only`, viditelný při focus)
- `id="main-content"` s `tabIndex={-1}` na `<main>`
- `aria-label` na sidebar nav, mobilní nav, mobilní menu button
- `aria-expanded` na mobilním menu toggle
- Sémantický `<nav>` místo `<div>` pro mobilní navigaci

**6. E2E Tests (NOC 20–24)**
- `noc20-23-features.spec.ts`: 12 specifikací pokrývající error handling, health ping, Swagger docs, kompresní headers, admin dashboard, lockout, password validation

**7. Version Bump → 2.4.0**
- API Swagger info, health endpoint, health/detailed — všechny na 2.4.0
- Testy aktualizovány pro novou verzi
- CHANGELOG.md aktualizován

---

## NOC 23 — v2.3.0 Performance, Indexes, Input Sanitization, Frontend Components

**Testy: 589/60 (všechny zelené) | Lint: 0 warningů | Frontend build: OK | Push: OK**

**1. Database Performance Indexes (35+)**
- Všechny hot-query tabulky pokryty: appointments (7 indexů), invoices (3), notifications (2), credit_transactions, waitlist, medical_reports, behavior_events, health_records, fio_transactions, messages (3), ratings (2), client_staff_notes, loyalty_points, working_hours, audit_log (2), refresh_tokens, health_goals, pending_bookings, client_packages, time_off_blocks, profile_log
- `CREATE INDEX IF NOT EXISTS` — safe pro opakované spouštění
- `db-indexes.test.ts`: 5 testů ověřují existenci klíčových indexů

**2. API Response Compression**
- `@fastify/compress` v7 — gzip/brotli pro všechny odpovědi >1KB
- Snížení velikosti JSON payloadů ~70%

**3. Cache Headers**
- Statické read endpointy (/services, /rooms, /packages): `Cache-Control: public, max-age=60, stale-while-revalidate=120`
- Swagger docs (/docs): `Cache-Control: public, max-age=3600`

**4. Input Sanitization Utilities**
- `apps/api/src/utils/sanitize.ts`: `escapeHtml`, `sanitizeText`, `sanitizeMultiline`, `normalizeEmail`, `sanitizePhone`, `clampPagination`
- XSS prevence: HTML entity escaping pro všechny user-supplied texty
- `sanitize.test.ts`: 14 testů

**5. Frontend Components**
- `LoadingSkeleton` — řádkový, kartový a tabulkový skeleton s animací
- `ErrorBoundary` — client-side error boundary s retry tlačítkem
- `Toast` — notification systém (success/error/info/warning) s auto-dismiss
- `useApiMutation` hook — reusable fetch s loading/error state
- CSS animace `animate-slide-in` pro toast notifikace

**6. Version Bump → 2.3.0**
- API Swagger info, health endpoint, health/detailed — všechny na 2.3.0
- Testy aktualizovány pro novou verzi
- CHANGELOG.md aktualizován

---

## NOC 22 — v2.2.0 Swagger API Documentation

**Testy: 569/58 (všechny zelené) | Lint: 0 warningů | Frontend build: OK | Push: OK**

**1. Swagger/OpenAPI Schema Enrichment**
- Vytvořen centralizovaný `apps/api/src/utils/swagger-schemas.ts` — organizace dle domén
- Přidán `zod-to-json-schema` pro automatickou konverzi sdílených Zod schémat
- JSON schemas pro 50+ route handlerů: Auth, Appointments, Users, Services, Rooms, Invoices, Credits, Notifications, Waitlist, Messages, Ratings, Export, Reports, Booking Public, Packages, Auto-Processor, Loyalty, Recommendations, iCal, System
- Swagger UI na `/docs` nyní zobrazuje kompletní API dokumentaci s tagy, security, body/query/params schemas

**2. Route Integration**
- 16 route souborů obohaceno o `{ schema: ... }` — Fastify automaticky validuje body
- Upravené soubory: auth, appointments, users, services, rooms, notifications, credits, messages, export, recommendations, loyalty, ical, booking-public, packages, auto-processor, server (health ping)

**3. Version Bump → 2.2.0**
- API Swagger info, health endpoint, health/detailed — všechny na 2.2.0
- Testy aktualizovány pro novou verzi
- CHANGELOG.md aktualizován

---

## NOC 21 — v2.1.0 Lint Cleanup & Polish

**Testy: 569/58 (všechny zelené) | Lint: 0 warningů | Frontend build: OK | Push: OK**

**1. ESLint Cleanup — Zero Warnings**
- `react-hooks/exhaustive-deps`: opravena závislost useEffect v admin audit log
- `@next/next/no-img-element`: avatar obrázky migrovány na `next/image` s `unoptimized` (dynamické API URL)
- Výsledek: `pnpm lint` → ✔ No ESLint warnings or errors

**2. Version Bump → 2.1.0**
- API Swagger info, health endpoint, health/detailed — všechny na 2.1.0
- Testy aktualizovány pro novou verzi

**3. CHANGELOG.md**
- Nový strukturovaný changelog s přehledem všech nocí (NOC 15–21)

---

## NOC 20 — Production Hardening & Deployment

**Testy: 569/58 (všechny zelené) | Frontend build: OK | Push: OK**

**Statistiky projektu:**
- 198 API endpointů (44 route soubory)
- 52 frontend stránek
- 58 testových souborů / 569 testů
- ~40 000 řádků TypeScript kódu
- 20 E2E Playwright specifikací
- CI pipeline (GitHub Actions): lint + test + build + Playwright E2E

### Fáze A — Quality hardening (předchozí run)
- TypeScript opravy: `AuthUser.userId→id`, ratings access control, unused apiBase
- Docker: `DOCKER_BUILD=1` env pro standalone Next.js output
- Bezpečnost: odstranění duplicitní helmet registrace, `poweredByHeader: false`
- Performance: `image/avif` + `image/webp` formáty
- API dokumentace: Swagger UI na `/docs`

### Fáze B — Production hardening (aktuální run)

**1. Graceful Shutdown**
- SIGTERM/SIGINT handling pro Docker — čistý close serveru

**2. Global Error Handler**
- `setErrorHandler`: strukturované JSON chybové odpovědi (error, message, statusCode)
- 5xx v produkci → "Internal Server Error" (žádné leaky chyb)
- `setNotFoundHandler`: strukturované 404 odpovědi
- `error-handling.test.ts`: 5 nových testů

**3. Request Tracing**
- `x-request-id` header propagace pro korelaci logů

**4. Security Headers (Frontend)**
- `next.config.ts`: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Nginx: OCSP stapling pro HTTPS

**5. Docker Compose Improvements**
- Healthcheck pro web service
- Nginx čeká na healthy web + api
- `docker-compose.staging.yml` — HTTP-only overlay
- `nginx/nginx-staging.conf` — HTTP-only nginx konfigurace

**6. Deployment Documentation**
- `DEPLOY.md` — kompletní průvodce: Quick Start, Staging, HTTPS, Certbot, env vars, backup, monitoring
- `README.md` aktualizován s odkazem na DEPLOY.md a staging varianta

---

## NOC 19 — Service Packages, Public Booking, E2E testy

**Testy: 564/57 (všechny zelené) | Frontend: updated | Push: OK**

**1. Service Packages — Backend API**
- schema.ts: tabulky service_packages, client_packages, pending_bookings
- GET /packages — seznam aktivních balíčků (public)
- POST /packages — vytvoření balíčku (ADMIN)
- PATCH /packages/:id — úprava balíčku (ADMIN)
- DELETE /packages/:id — deaktivace balíčku (ADMIN)
- POST /packages/:id/purchase — koupě balíčku klientem + credit_transactions
- GET /clients/:id/packages — balíčky klienta se zbývajícími sezeními
- packages.test.ts: 7 testů (CRUD + purchase + access control)

**2. Public Online Booking — Backend**
- POST /booking/public (bez auth) — vytvoří pending_booking + notifikace ADMIN/RECEPTION
- GET /booking/public/pending — čekající rezervace (ADMIN/RECEPTION only)
- auth.ts: /booking/public + /packages přidány do public routes
- public-booking.test.ts: 4 testy

**3. Frontend**
- admin/packages/page.tsx: CRUD stránka balíčků (seznam, formulář, deaktivace)
- client/packages/page.tsx: klientský přehled + nákup balíčků
- booking/page.tsx: veřejná rezervační stránka (sloty → formulář → potvrzení)
- Layout.tsx: nav link "Balíčky" pro ADMIN + CLIENT

**4. E2E testy**
- noc18-features.spec.ts: admin stats exporty, reporty, reception recurring
- noc19-features.spec.ts: public booking stránka, admin packages, client packages

---

## NOC 18 — Recurring Appointments, CSV Export, Reports, Frontend, E2E

**Testy: 553/55 (všechny zelené) | Frontend: updated | Push: OK**

**1. Recurring Appointments API**
- Runtime migration: recurrence_rule, recurrence_end_date, recurrence_parent_id sloupce v appointments
- POST /appointments/:id/recurrence — vytvoření série WEEKLY/BIWEEKLY/MONTHLY (max 52)
- DELETE /appointments/:id/recurrence — zrušení budoucích termínů v sérii
- GET /appointments?recurringOnly=true — filtr opakujících se termínů
- recurrence.test.ts: 4 testy

**2. CSV Export API**
- GET /export/clients.csv — klienti s věrnostními body (ADMIN/RECEPTION)
- GET /export/appointments.csv?from&to — termíny (ADMIN/RECEPTION)
- GET /export/invoices.csv?from&to — faktury (ADMIN only), UTF-8 BOM pro Excel
- csv-export.test.ts: 3 testy

**3. Monthly Revenue + Occupancy Reports**
- GET /reports/revenue-monthly?year — 12 měsíců s výnosy, fakturami, novými klienty
- GET /reports/occupancy-weekly?from&to — skupiny po týdnech s obsazeností
- reports-new.test.ts: 3 testy

**4. Frontend**
- admin/stats: záložka "Exporty" (3 CSV tlačítka s date pickers)
- admin/stats: záložka "Reporty" (bar chart výnosů + tabulka týdenní obsazenosti)
- reception/appointments: tlačítko "Opakovat" otevírá modal s výběrem frekvence a konce

**5. E2E testy NOC 17**
- noc17-features.spec.ts: auto-processor trigger, notification preferences, audit log tab

---

## Aktuální stav (2026-03-18, noc 17)

### ✅ NOC 17 — Auto-Processor Cron, Notification Prefs, E2E NOC16, Audit Log UI

**Testy: 543/52 (všechny zelené) | Frontend build: OK | Push: OK**

**1. Auto-Processor Cron Scheduler**
- node-schedule: no-show processor (02:00), invoice overdue (03:00)
- GET /auto-processor/schedule — info o dalším běhu (ADMIN)
- scheduler.test.ts: 1 test

**2. Notification Preferences**
- Schema: tabulka notification_preferences
- GET/PATCH /notification-preferences
- Client settings page wired to API
- notification-prefs.test.ts: 4 testy

**3. E2E testy NOC 16**
- noc16-features.spec.ts: messages, employee/clients, iCal, audit log UI

**4. Admin Audit Log UI**
- Záložka "Audit Log" v /admin/background
- Filter + tabulka + Load more paginace

---

## Aktuální stav (2026-03-18, noc 16)

### ✅ NOC 16 — Direct Messages, Ratings, Staff Notes, Timeline, Auto-Processor, Recommendations, iCal, Employee Clients

**Testy: 538/50 (všechny zelené) | Frontend build: OK | Push: OK**

**1. Direct Messages (Přímé zprávy)**
- Schema: tabulka `messages` (id, from_user_id, to_user_id, subject, body, is_read, parent_id, created_at)
- `GET /messages` — inbox + sent, paginace
- `GET /messages/unread-count` — lightweight count pro badge
- `GET /messages/:id` — detail + auto-mark-read + replies
- `POST /messages` — odeslat zprávu s validací
- `PATCH /messages/:id/read` — označit přečtené
- `DELETE /messages/:id` — smazat (autor/ADMIN)
- `GET /messages/contacts` — seznam možných příjemců dle role
- Frontend: `/messages` — inbox/sent, compose modal, reply, thread view
- Layout: odkaz "Zprávy" v navigaci pro všechny role
- `messages.test.ts`: 6 testů

**2. Appointment Ratings (Hodnocení termínů)**
- Schema: tabulka `appointment_ratings` (unique per appointment_id)
- `POST /appointments/:id/rating` — CLIENT hodnotí 1–5 hvězd, jen COMPLETED termíny
- `GET /appointments/:id/rating` — detail hodnocení
- `GET /employees/:id/ratings` — průměrné hodnocení terapeuta
- `GET /ratings/summary` — leaderboard terapeutů (ADMIN/RECEPTION)
- Frontend: klientská stránka termínů — star rating pro COMPLETED termíny
- Admin stats: nová záložka "Hodnocení terapeutů"
- Admin background: employee ratings widget
- Employee appointments: vlastní rating widget
- `ratings.test.ts`: 6 testů

**3. Staff Client Notes (Interní poznámky o klientech)**
- Schema: tabulka `client_staff_notes` (is_private pro ADMIN only)
- `GET /clients/:id/staff-notes` — RECEPTION/EMPLOYEE vidí veřejné + vlastní, ADMIN vše
- `POST /clients/:id/staff-notes` — přidat poznámku
- `PATCH /staff-notes/:id` — editace (autor/ADMIN)
- `DELETE /staff-notes/:id` — smazání (autor/ADMIN)
- Frontend: reception/clients/[id] — sekce "Interní poznámky" s CRUD UI
- `client-staff-notes.test.ts`: 5 testů

**4. Client Timeline (Časová osa událostí)**
- `GET /clients/:id/timeline` — chronologická osa: termíny, faktury, kredity, lékařské zprávy, věrnostní body, zprávy
- Cursor-based paginace (nextCursor)
- Frontend: komponenta `ClientTimeline.tsx` — timeline s ikonami a barevnými badges
- Reception client detail: nová záložka "Časová osa"
- `timeline.test.ts`: 4 testy

**5. Auto-Processor (Automatické zpracování)**
- `POST /auto-processor/no-shows` — označí overdue CONFIRMED jako NO_SHOW, penalty -20 bodů
- `POST /auto-processor/invoice-overdue` — označí po splatnosti SENT faktury jako OVERDUE
- `GET /auto-processor/status` — info o posledním běhu
- Frontend: admin background — "Auto-Processor" panel s tlačítkem spustit
- `auto-processor.test.ts`: 5 testů

**6. Smart Recommendations (Doporučovací engine)**
- `GET /recommendations/rebooking` — klienti bez nadcházejícího termínu (30 dní)
- `GET /recommendations/at-risk` — klienti s nízkým behavior score / dlouhou absencí
- `GET /recommendations/loyalty-rewards` — klienti blízko věrnostního milníku
- Frontend: reception dashboard — "Doporučit termín" a "Rizikoví klienti" panely
- `recommendations.test.ts`: 4 testy

**7. iCal Export**
- `GET /appointments/export/ical` — termíny jako .ics (RFC 5545)
- Filtrování: from/to/employeeId
- Role-scoped: EMPLOYEE vidí vlastní, RECEPTION/ADMIN vše, CLIENT vlastní
- Frontend: reception appointments — tlačítko "↓ iCal"
- `ical.test.ts`: 3 testy

**8. Employee Clients + Stats**
- `GET /employees/me/clients` — unikátní klienti terapeuta (session count, last session, behavior score)
- `GET /employees/me/stats` — kompletní statistiky (total/completed, revenue, avg rating)
- Frontend: `/employee/clients` — stránka s přehledem klientů + statwidgety
- Layout: odkaz "Moji klienti" v navigaci EMPLOYEE
- `employee-clients.test.ts`: 3 testy

**9. PDF pro terapeuta**
- `GET /clients/:id/appointments/pdf` — PDF přehled termínů klienta
- Reception client detail: tlačítko "PDF termínů"

---

## Aktuální stav (2026-03-18, noc 15)

### ✅ NOC 15 — Reminders SMS/Email, Waitlist Auto-Fill, Loyalty Points, Appointment Templates, Health Goals, System Health Monitor

**Testy: 502/42 (všechny zelené) | Frontend build: OK | Push: OK**

**1. Appointment Reminders — SMS + Email (ROZŠÍŘENÍ)**
- Kód pro SMS/Email odesílání v reminders.ts existoval už z NOC 14
- `reminders-notifications.test.ts`: 3 testy — SMS odesílání, Email odesílání, žádné notifikace
- `appointments.ts`: přidáno email odesílání při waitlist notifikaci po CANCEL (kromě in-app)

**2. Appointment Waitlist Auto-Fill**
- `appointments.ts` PATCH CANCELLED: přidáno email odesílání pro čekající klienty (kromě in-app notifikace)
- `waitlist-autofill.test.ts`: 3 testy — WAITLIST_AVAILABLE notifikace, status NOTIFIED, žádné duplikáty

**3. Client Loyalty Points System**
- Schema: tabulka `loyalty_points` (id, user_id, points, reason, created_at)
- Runtime migration: `CREATE TABLE IF NOT EXISTS loyalty_points`
- Logika: +10 bodů při COMPLETED appointment, +5 bodů při PAID invoice
- `GET /loyalty/points` → { balance, history[] } (CLIENT: vlastní, ADMIN/RECEPTION: ?userId=)
- `GET /loyalty/leaderboard?limit=N` → top klienti dle bodů (ADMIN/RECEPTION)
- Frontend: Client progress — "Věrnostní body" widget (balance + poslední transakce)
- Frontend: Admin stats — záložka "Věrnostní program" — leaderboard tabulka
- `loyalty.test.ts`: 4 testy

**4. Appointment Templates**
- Schema: tabulka `appointment_templates`
- `POST/GET/DELETE /appointment-templates`
- Frontend: Reception nový termín — dropdown "Použít šablonu"
- Frontend: Admin settings — sekce "Šablony termínů"
- `appointment-templates.test.ts`: 3 testy

**5. Client Health Goals**
- Schema: tabulka `health_goals`
- `POST/GET/PATCH/DELETE /clients/:id/health-goals` + `/health-goals/:id`
- Frontend: Client progress + Employee appointments ClientCard
- `health-goals.test.ts`: 4 testy

**6. Admin System Health Monitor (rozšíření)**
- `GET /health/detailed` rozšířen o: `dbSize`, `tableStats`, `pendingReminders`
- Frontend: Admin background — "System Health" panel
- `health-extended.test.ts`: 2 testy

---

## Archivní stavy (NOC 8–14)

Viz předchozí verze POSTUP.md (Git history).

---

## ⚠️ Bloky

### ✅ Vyřešeno
1. **FIO auto-sync** — `FIO_API_TOKEN` dostupný v `pwa-env-production`
2. **Push delivery VAPID** — VAPID klíče dostupné v `pwa-env-production`
3. **Auto-processor cron** — implementováno v `scheduler.ts` (no-show 02:00, invoice-overdue 03:00)

### Otevřené
4. **Staging deployment** — Docker Compose + staging overlay připraven, ale nenasazeno na VPS

## Doporučené další kroky (prioritně)
1. **Deploy na VPS** — Docker Compose ready, DEPLOY.md průvodce, staging overlay, Certbot SSL
2. **E2E smoke testy na staging** — ověřit klíčové flows po nasazení
3. **Monitoring setup** — UptimeRobot/Betterstack na /health/ping endpoint
4. **Swagger schema enrichment** — přidat detailní schemas ke kritickým endpoints

## Projekt je feature-complete ✅
Všechna acceptance kritéria ze ZADANI.md splněna. Aplikace je připravena k nasazení.
