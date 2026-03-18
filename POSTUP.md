# POSTUP.md — Pristav Radosti v2

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
4. **Staging deployment** — Docker Compose připraven, ale nenasazeno na Render/VPS

## Doporučené další kroky
1. **Staging/production deploy na Render** — Docker Compose ready, `.env.production` připraven
2. **E2E smoke testy na staging** — ověřit klíčové flows po nasazení
