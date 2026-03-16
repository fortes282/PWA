# POSTUP.md — Pristav Radosti v2

## Aktuální stav (2026-03-16, noc 8 — 05:45)

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
