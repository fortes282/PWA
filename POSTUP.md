# POSTUP.md — Pristav Radosti v2

## Aktuální stav (2026-03-17, noc 9 — 03:00)

### ✅ NOC 9 — API rozšíření + test coverage + frontend vylepšení

**Noc 9 — nové:**

#### Nové API endpointy
- `GET /appointments/upcoming` — klientovy termíny v příštích 7 dnech (max 20)
- `GET /appointments/history?page=&limit=` — paginated minulé termíny (COMPLETED/CANCELLED/NO_SHOW)
- `GET /appointments/stats` — summary counts (total/confirmed/completed/cancelled/noShow/pending/upcoming)
- `GET /appointments/today` — dnešní termíny (RECEPTION/EMPLOYEE scoped na serveru)
- `POST /appointments/:id/confirm` — quick confirm PENDING → CONFIRMED (RECEPTION/ADMIN)
- `GET /notifications/unread-count` — lightweight badge count { count: N }
- `GET /invoices/overdue` — faktury po splatnosti + auto-mark OVERDUE
- `GET /waitlist/suggestions?serviceId=&limit=` — nejdéle čekající klienti (enriched)
- `GET /health/ping` — ultra-lightweight uptime endpoint

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

### 📊 Metriky noc 9
- API routes: 65+
- Integration tests: **347 testů / 25 test souborů**, **0 selhání**
- Playwright E2E spec souborů: **13** (55 testů)
- Lint: ✅ | Build: ✅

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
