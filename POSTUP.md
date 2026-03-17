# POSTUP.md — Pristav Radosti v2

## Aktuální stav (2026-03-18, noc 13)

### ✅ NOC 13 — Conflict detection, Recurring appointments, Global search, Time-off blocks, Monthly reports

**Testy: 461/31 (všechny zelené) | Frontend build: OK | Push: OK**

**1. Appointment Conflict Detection**
- POST /appointments vrací `{ error: "CONFLICT", message: "..." }` (409) pro employee i client konflikty
- Kontrola time_off_blocks při vytváření termínu
- GET /appointments/availability?employeeId=X&date=YYYY-MM-DD — dostupné a obsazené sloty
- 8 nových testů (conflict detection)

**2. Recurring Appointments**
- Tabulka `appointment_series` v schema.ts + runtime migration
- POST /appointments/series — vytvoří sérii + generuje termíny na 8 týdnů dopředu
- GET /appointments/series — seznam sérií (ADMIN/RECEPTION)
- DELETE /appointments/series/:id — zruší sérii + budoucí termíny
- 6 testů v appointment-series.test.ts

**3. Global Search**
- GET /search?q=&limit= — prohledá users, appointments, invoices, medical reports
- Frontend: GlobalSearch.tsx component s debounce 300ms + dropdown
- Integrováno v Layout.tsx (sidebar + mobile header) pro ADMIN/RECEPTION/EMPLOYEE
- 5 testů v search.test.ts

**4. Employee Time-Off Blocks**
- Tabulka `time_off_blocks` + runtime migration
- POST/GET/DELETE /employees/:id/time-off
- Appointment creation kontroluje time_off_blocks (409 pokud překryv)
- 6 testů v time-off.test.ts

**5. Monthly Business Report**
- GET /reports/monthly?year=YYYY&month=MM (ADMIN only)
- Vrátí: revenue (total, byService), appointments stats, topClients, topEmployees, newClients, avgSessionValue
- Frontend: admin/stats stránka — záložka "Měsíční zprávy" s year/month pickerem
- 4 testy v reports.test.ts

---

## Aktuální stav (2026-03-17, noc 12 — 04:30)

### ✅ NOC 12 — Password reset, Avatar upload, Stats rozšíření, CSV exporty, UX vylepšení

**1. Password Reset Flow**
- `POST /auth/forgot-password` — anti-enumeration, pošle reset email
- `POST /auth/reset-password` — validace tokenu + nové heslo (min 8 znaků)
- `GET /auth/reset-password/validate` — pre-validace tokenu (frontend)
- `password_resets` tabulka v schema.ts + runtime migration
- Frontend: `/forgot-password` stránka + `/reset-password` s strength metrem
- Login stránka: odkaz "Zapomněli jste heslo?"
- 12 nových testů

**2. Avatar Upload**
- `PATCH /users/me/avatar` — base64 data URL upload (max 2 MB, jpg/png/webp/gif)
- `DELETE /users/me/avatar` — odstranění avataru
- `@fastify/static 6.x` — servírování avatarů z `/avatars/*`
- Settings stránka: avatar upload/remove UI s preview
- Layout sidebar: zobrazení avataru (fallback na initials)
- AuthUser interface: `avatarUrl` field

**3. Stats rozšíření**
- `GET /stats/rooms-utilization?days=N` — obsazenost místností (utilizationPct, avgPerDay)
- `GET /stats/employees-performance?days=N` — výkon terapeutů (completionRate, ADMIN only)
- Admin stats stránka: rooms utilization widget + employee performance tabulka
- Period selector (7/30/90/365 dní)
- 7 nových testů

**4. CSV exporty**
- `GET /appointments/export/csv` — export termínů (ADMIN/RECEPTION), filters: from/to/status
- `GET /invoices/export/csv` — export faktur (ADMIN/RECEPTION), filters: status/from/to
- Reception appointments + billing: CSV export tlačítka

**5. Waitlist Notify Endpoint**
- `POST /waitlist/:id/notify` — notifikuje čekajícího klienta o volném místě
  WAITLIST_AVAILABLE in-app notifikace + email + status NOTIFIED
- Reception waitlist: napojeno na nový endpoint
- 4 nové testy

**6. Sequential Invoice Numbers**
- Faktury nyní dostávají čísla ve formátu `INV-YYYY-NNNN`
- Auto-increment per rok, reset každý nový rok
- 2 nové testy

**7. Batch Users**
- `POST /batch/users/active` — bulk (de)aktivace uživatelů (ADMIN only)
- 4 nové testy

**8. Admin UX vylepšení**
- Admin users stránka: role filter + status filter + bulk select + bulk deactivate/activate
- `/admin/medical-reports` — přehled všech lékařských zpráv s fulltext search
- `/admin/notifications` — hromadné notifikace (podle role / konkrétním uživatelům)
- SMTP status + email test endpoint + admin settings UI (EmailTestSection)
- `POST /system-settings/email/test` — testovací email
- `GET /system-settings/smtp/status`

**9. OfflineBanner**
- Globální banner při ztrátě WiFi/internetu
- Auto-hide po 3s při obnovení připojení

**10. E2E testy**
- `auth-reset.spec.ts` — forgot-password + reset-password stránky (7 testů)

**Výsledky:**
- Testy: **432 / 27 souborů** (bylo 395/26, +37 testů)
- Build: ✅ `pnpm --filter web build` OK
- Push: ✅ main branch aktualizován (12 commitů v noci 12)

### ⚠️ Bloky (beze změny)
1. FIO auto-sync — chybí FIO_API_KEY
2. VAPID keys — chybí v prod
3. Staging deployment — nenasazeno

---

## Aktuální stav (2026-03-17, noc 11 — 03:16)

### ✅ NOC 11 — Audit hooks, Admin audit stránka, Rate limiter, Testy

**1. Audit hook integrace (všechny routes)**
- `auth.ts`: POST /auth/login → USER_LOGIN (s IP), POST /auth/logout → USER_LOGOUT
- `users.ts`: PATCH /users/:id → USER_UPDATED, DELETE /users/:id → USER_DELETED, POST /users/:id/reactivate → USER_REACTIVATED
- `users.ts`: Přidán nový endpoint POST /users (vytvoření uživatele) → USER_CREATED
- `appointments.ts`: POST /:id/confirm → APPOINTMENT_CONFIRMED, PATCH /:id (cancelled) → APPOINTMENT_CANCELLED
- `appointments.ts`: Přidány nové endpointy POST /:id/cancel, PATCH /:id/status s audit záznamy
- `invoices.ts`: POST /invoices → INVOICE_CREATED, PATCH /invoices/:id/status → INVOICE_UPDATED
- `services.ts`: POST/PATCH/DELETE → SERVICE_CREATED/UPDATED/DELETED
- `rooms.ts`: POST/PATCH/DELETE → ROOM_CREATED/UPDATED/DELETED
- `logAudit()` failuje tiše (try/catch) — bezpečné pro testy bez audit_log tabulky

**2. Admin frontend: /admin/audit**
- Tabulka: Čas, Akce, Uživatel, Cíl, IP
- Filtry: userId, action (select), from/to date
- Paginace (prev/next)
- RouteGuard role=["ADMIN"]
- Loading skeleton (SkeletonLine)
- EmptyState pro prázdné výsledky

**3. Layout.tsx**
- Přidán odkaz "Audit log" → /admin/audit do admin navigace (ShieldAlert ikona)

**4. Audit integration testy**
- 3 nové testy v audit.test.ts
- POST /auth/login → vytvoří USER_LOGIN záznam
- POST /users → vytvoří USER_CREATED záznam
- PATCH /users/:id → vytvoří USER_UPDATED záznam

**5. E2E: admin-audit.spec.ts**
- Admin naviguje na /admin/audit
- Vidí tabulku s headers
- Vidí data nebo empty state
- Filtruje podle akce
- Sidebar má odkaz na audit

**6. Rate limiting**
- In-memory Map middleware: IP → {count, windowStart}
- /auth/login: max 10 req/min per IP, vrací 429 s retryAfter
- Doplňuje existující @fastify/rate-limit plugin (per-route config v auth.ts)

**Výsledky:**
- Testy: **395 / 26 souborů** (bylo 392, přidány 3 audit integration testy)
- Build: ✅ `pnpm --filter web build` OK
- Push: ✅ main branch aktualizován

### ⚠️ Bloky (beze změny)
1. FIO auto-sync — chybí FIO_API_KEY
2. VAPID keys — chybí v prod
3. Staging deployment — nenasazeno

---

## Aktuální stav (2026-03-17, noc 10 — 03:00)

### ✅ NOC 10 — Loading states, EmptyState, Audit log, Notifications

- Loading.tsx skeletony: 14 routes
- EmptyState komponenta: použita na 6 místech
- Audit log: schema + GET /audit + GET /audit/me + 6 testů
- Notifications: DELETE /:id (admin fix) + PATCH /mark-all-read + frontend ✕ buttons
- Dashboards: system health indicator (Systém OK / Chyba DB + uptime)
- Celkový počet testů: 392 / 26 souborů

### ⚠️ Bloky (beze změny)
1. FIO auto-sync — chybí FIO_API_KEY
2. VAPID keys — chybí v prod
3. Staging deployment — nenasazeno

---

## Aktuální stav (2026-03-17, noc 9 — 04:45)

### ✅ NOC 9 — API rozšíření + test coverage + frontend vylepšení

**Noc 9 — nové:**

#### Nové API endpointy (noc 9 — finální)
- `GET /appointments/upcoming` — klientovy termíny v příštích 7 dnech (max 20)
- `GET /appointments/history?page=&limit=` — paginated minulé termíny
- `GET /appointments/stats` — summary counts (total/confirmed/completed/cancelled/noShow/pending/upcoming)
- `GET /appointments/today` — dnešní termíny (server-scoped)
- `GET /appointments/no-shows?from=&to=&limit=` — no-show přehled (ADMIN/RECEPTION)
- `GET /appointments/pending-activation` — PENDING bez aktivace (RECEPTION/ADMIN)
- `POST /appointments/:id/confirm` — quick confirm PENDING → CONFIRMED
- `GET /notifications/unread-count` — lightweight badge count { count: N }
- `GET /invoices/overdue` — faktury po splatnosti + auto-mark OVERDUE
- `GET /waitlist/suggestions?serviceId=&limit=` — nejdéle čekající klienti (enriched)
- `GET /health/ping` — ultra-lightweight uptime endpoint
- `GET /employees` — shortcut pro /users?role=EMPLOYEE (any auth)
- `GET /clients` — shortcut pro /users?role=CLIENT (ADMIN/RECEPTION/EMPLOYEE)
- `GET /rooms/:id` — detail místnosti
- `GET /stats/top-clients?limit=` — top klienti dle aktivity (ADMIN/RECEPTION)
- `GET /stats/revenue-summary` — finanční KPIs (totalRevenue/month/week/avgPerSession)
- `GET /credits/stats` — credit summary pro klienta (balance/totalIn/totalOut)
- `GET /dashboard/employee` — employee daily summary

#### Nové integrační testy
- `behavior.test.ts` — 11 testů (GET /behavior/:userId, POST /behavior/record, score clamping)
- `system-settings.test.ts` — 13 testů (public/admin RBAC, upsert, key whitelist)
- `pdf.test.ts` — 18 testů (PDF/DOCX: RBAC, 404, content-type)
- Rozšíření `waitlist.test.ts` — 4 testy pro /waitlist/stats
- Rozšíření `users.test.ts` — 5 testů pro /users/:id/profile-log
- Rozšíření `notifications.test.ts` — 3 testy pro /notifications/unread-count
- Rozšíření `invoices.test.ts` — 4 testy pro /invoices/overdue
- Rozšíření `appointments.test.ts` — 7+5+4+5 testů (upcoming, history, stats, today, confirm)
- Rozšíření `health.test.ts` — 2 testy pro /health/ping

#### Frontend vylepšení
- Client dashboard: widget "Nadcházející termíny (7 dní)" s status badge
- Client appointments: paginated history tab (10/page), upcoming uses /appointments/upcoming
- Client progress: uses /appointments/stats
- Reception dashboard: no-show risk widget (klienti se skóre < 60), /appointments/today endpoint
- Reception billing: overdue invoice alert widget
- Reception waitlist: "Návrhy" tab — top waiting clients sorted by wait time
- Reception appointments: Potvrdit uses /appointments/:id/confirm
- Employee dashboard: uses /appointments/today
- NotificationBell: lazy-load full list (only on open), poll only count every 30s

#### Nové E2E spec soubory
- `e2e/client-extra.spec.ts` — invoices, health-record, credit-request
- `e2e/reception-extra.spec.ts` — schedule, credit-requests
- `e2e/admin-extra.spec.ts` — stats revenue, FIO CSV export, background
- `e2e/detail-pages.spec.ts` — admin/users/[id], reception/clients/[id], invoices/[id]

### 📊 Metriky noc 9 (finální)
- API routes: **80+** (noc 8: 55+)
- Integration tests: **381 testů / 25 test souborů**, **0 selhání** (noc 8: 257/22)
- Playwright E2E spec souborů: **13** (noc 8: 10)
- Frontend zlepšení: **15+ komponent/stránek** vylepšeno
- Lint: ✅ | Tests: ✅ | Všechny commity pushnuty

### 🚀 Git stats noc 9
- Commity: 45+ v okně 02:00–04:45
- Nové endpointy: 18
- Nové/rozšířené testy: +124 testů
- Refaktory: 21 frontend souborů (API shortcuts)

### ⚠️ Bloky (beze změny)
1. **FIO auto-sync** — chybí `FIO_API_KEY`
2. **Plně reálné push delivery** — VAPID klíče chybí v prod prostředí
3. **Staging deployment** — Docker Compose připraven, VPS/Railway nenasazeno

## Archivní stav (2026-03-16, noc 8 — 05:45)

### ✅ PROJEKT KOMPLETNÍ — 60/60 + rozšíření

**Původní ZADANI.md: 60/60 checkboxů splněno** (dokončeno v noci 7)

**Noc 8 — dodatečná vylepšení:**

#### Nové API endpointy
- `GET /health/detailed` — monitoring: DB ping, feature flags, uptime, config
- `DELETE /notifications/clear-read` — bulk smazání přečtených notifikací
- `GET /credits/history?page=&limit=` — paginovaná kreditová historie
- `GET /credits/summary/:userId` — souhrn kreditů pro ADMIN/RECEPTION
- `GET /fio/export/csv` — FIO transakce → CSV (BOM, Excel-friendly)
- `GET /users/me` — shortcut aktuálního uživatele
- `POST /users/:id/reactivate` — obnovení deaktivovaného uživatele
- `GET /users/export/csv` — export uživatelů/klientů CSV
- `GET /appointments/calendar?from=&to=` — obohacené termíny pro kalendář (bez CANCELLED)
- `PATCH /appointments/:id/notes` — editace poznámek bez změny statusu
- `GET /appointments/:id` — enriched (clientName, employeeName, serviceName)
- `GET /appointments?status=X,Y&search=&limit=&page=` — multi-status filtr, search, paginace
- `GET /dashboard/reception` — agregovaný endpoint pro reception dashboard
- `GET /dashboard/client` — agregovaný endpoint pro klientský dashboard
- `POST /batch/appointments/status` — hromadná změna statusu termínů (max 100)
- `POST /batch/notifications` — hromadné notifikace (by userIds nebo roles, max 500)
- `DELETE /medical-reports/:id` — smazání zprávy (employee/admin)
- `GET /stats` + `revenueByMonth` — výnosy po měsících (12 měsíců)
- `GET /services?includeInactive=true` — admin: všechny služby
- `appointments.cancellationReason` — důvod zrušení termínu

#### Frontend
- `/client/invoices` — klientský přehled faktur s PDF download
- Admin Stats: chart výnosů po měsících
- Admin Users: tlačítko 'Obnovit' pro deaktivované uživatele
- Reception Clients: CSV export button
- Reception Appointments: search v poznámkách
- NotificationBell: tlačítko 'Smazat přečtené'
- Client Appointments: zobrazení `cancellationReason`
- Admin FIO: CSV export button

#### Infrastruktura/Ops
- `DEPLOYMENT.md` — kompletní produkční průvodce
- `nginx/nginx.conf` — plná HTTPS konfigurace (TLS 1.3, HSTS preload, ACME)
- `docker-compose.yml` — Certbot service, SMSAPI_TOKEN env var
- `seed.ts` — faktury, FIO transakce, credit requests
- Schema migration: `appointments.cancellation_reason` s safe ALTER TABLE

### 📊 Finální metriky (noc 8)
- API routes: 55+
- Frontend pages: 39+
- Integration tests: **257 testů / 22 test souborů**, **0 selhání**
- Playwright E2E: **55 testů ✅** (auth, pwa, client, reception, admin, employee, notifications, settings)
- Build: ✅ | Lint: ✅ | Tests: ✅

### ⚠️ Bloky (čeká na uživatele)
1. **FIO auto-sync** — `GET /fio/sync` by volal FIO API přímo. Chybí `FIO_API_KEY`. Ruční import + párování funguje.
2. **Plně reálné push delivery** — VAPID klíče chybí v prod prostředí. Subscription flow hotový.
3. **Staging deployment** — Docker Compose připraven, VPS/Railway nenasazeno.

### 🚀 Deployment ready
- Docker Compose: `api` + `web` + `nginx` + optional `certbot`
- Health check: `GET /health` + `GET /health/detailed`
- Auto-reminder scheduler (hourly, 24h okno)
- SQLite backup: `data/backup.sh` + `BACKUP_KEEP_DAYS=14`
- `.env.example` + `DEPLOYMENT.md` — kompletní šablony

## Doporučené další kroky
1. **Staging deployment** na VPS/Railway pro UAT
2. **FIO auto-sync cron** (pokud dostaneme API key)
3. **Push delivery validace** — nasadit VAPID keys + ověřit live delivery
4. **Playwright E2E** — rozšířit smoke suite o nové stránky (invoices, calendar endpoint)
