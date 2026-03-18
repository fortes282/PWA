# POSTUP.md — Pristav Radosti v2

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

## ⚠️ Bloky (beze změny)
1. **FIO auto-sync** — chybí `FIO_API_KEY`
2. **Push delivery validace** — VAPID klíče chybí v prod
3. **Staging deployment** — Docker Compose připraven, VPS/Railway nenasazeno

## Doporučené další kroky
1. **Staging deployment** na VPS/Railway pro UAT
2. **Auto-processor cron** — automatické spouštění no-show procesoru (např. každou noc ve 02:00)
3. **FIO auto-sync** — pokud dostaneme API key
4. **Push delivery** — nasadit VAPID keys
5. **E2E testy** — rozšířit o nové stránky (messages, employee/clients, ratings)
