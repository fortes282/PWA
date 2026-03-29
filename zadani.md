# Zadání — Přístav Radosti PWA

> Komplexní popis všech funkcí aplikace a jak fungují.
> Tento dokument se aktualizuje po každé významné změně.
>
> **Poslední aktualizace:** 2026-03-29

---

## Přehled

Přístav Radosti je PWA (Progressive Web App) pro neurorehabilitační centrum. Umožňuje klientům rezervovat terapie, spravovat kredity a sledovat pokrok; terapeutům řídit svůj kalendář a psát zprávy; recepci a administrátorům kompletně spravovat provoz centra.

**Tech stack:** Next.js 15 + React 19 (frontend), Fastify 5 (backend), SQLite / Drizzle ORM (databáze), Docker Compose (deploy)

**Role:** CLIENT, EMPLOYEE (terapeut), RECEPTION (recepce), ADMIN

---

## 1. Autentizace a role

### JWT autentizace
- Přihlášení přes email + heslo → access token (krátkodobý) + refresh token (30 dní, httpOnly cookie)
- Automatický refresh při 401
- Trvalé přihlášení 30 dní (localStorage + refresh token)

### Dvoufaktorové ověření (2FA / TOTP)
- Nastavení přes QR kód (TOTP standard)
- Při přihlášení: email+heslo → pendingToken → TOTP kód → plný JWT
- Záložní kódy (jednorázové, 10 ks)
- Povinné pro ADMIN a EMPLOYEE

### Rate limiting
- Login: 10 pokusů / 5 minut (na IP)
- Refresh: 30 req / min
- Obecné API: 100 req / min
- V CI/test módu limity vypnuté

### Oprávnění podle role

| Funkce | CLIENT | EMPLOYEE | RECEPTION | ADMIN |
|--------|--------|----------|-----------|-------|
| Rezervace termínu | ano | ne | pro klienta | pro klienta |
| Správa slotů / harmonogram | ne | ne | ano | ano |
| Vlastní pracovní doba (view) | ne | ano (svou) | ano (všechny) | ano (všechny) |
| Rušení termínů | vlastní | ne | libovolné | libovolné |
| Fakturace | ne | ne | ano | ano |
| Pojišťovny | ne | ne | ne | ano |
| Statistiky / BI | ne | ne | ne | ano |
| Nastavení systému | ne | ne | ne | ano |
| GDPR výmaz | žádost | ne | ne | schvaluje |

---

## 2. Rezervační systém (Booking V2 — Open Slots)

### Klientský booking kalendář (`/client/booking`)
- **Custom měsíční kalendář** — velké dotykové buňky (min 44×44px)
- **Obsazenost u každého dne** — procento volných slotů (např. "73%")
- **Barevné kódování** podle obsazenosti:
  - Zelená: 0–50 % obsazeno (hodně volného)
  - Žlutá: 51–80 % (plní se)
  - Oranžová: 81–99 % (skoro plno)
  - Červená: 100 % (obsazeno, neklikatelné, zobrazí "plno")
- **Klik na den** = filtr dostupných časů pod kalendářem
- **Navigace** — šipky pro měsíce, dnešek zvýrazněn
- **Legenda** — 4 barevné úrovně s popisem

### Třívrstvý model

**Vrstva 1 — Pracovní doba (týdenní šablona)**
- ADMIN/RECEPTION definuje pro každého terapeuta: den, začátek, konec, přestávka
- Endpoint: `GET/PUT /work-schedule/:employeeId`
- Employee může svou pracovní dobu pouze zobrazit (ne měnit)

**Vrstva 2 — Otevřené sloty (konkrétní datumy)**
- ADMIN/RECEPTION vytvoří sloty pro terapeuta na zvolené období
- Endpoint: `POST /slots/open` — generuje 30min intervaly podle pracovní doby
- Automaticky přeskakuje přestávky a nepřítomnost
- Employee **nemá přístup** k otevírání slotů (od 2026-03-29)

**Vrstva 3 — Rezervace (obsazení slotu)**
- Klient vybere volný slot → vytvoří se appointment
- Endpoint: `POST /bookings-v2`
- Slot se označí jako obsazený

### Nepřítomnost (Time-off)
- EMPLOYEE může vytvářet vlastní nepřítomnost
- ADMIN/RECEPTION může vytvářet nepřítomnost pro libovolného terapeuta
- Vytvoření nepřítomnosti automaticky ruší kolidující otevřené sloty + notifikuje dotčené klienty

### Stránky
- `/reception/schedule` — sdílená stránka pro RECEPTION i ADMIN (taby: Rezervace, Pracovní doba, Nepřítomnost, Chytré doplnění)
- `/admin/schedule` → redirect na `/reception/schedule`
- `/employee/schedule` → redirect na `/employee` (Employee nemá přístup ke správě slotů)

### Kalendářní zobrazení harmonogramu
- **Týdenní grid** — 7 sloupců (Po–Ne) × 18 řádků (08:00–16:30 po 30 min)
- **Barevné kódování** podle terapeuta (6 barev: modrá, fialová, teal, růžová, oranžová, zelená)
- **Režim "Všichni"** — zobrazí sloty všech terapeutů najednou s legendou
- **Navigace** — šipky předchozí/další týden + tlačítko "Dnes"
- **Klik na slot** → detail modal (rezervovat pro klienta, zrušit slot/rezervaci)
- **Pracovní doba** — pouze pro čtení (tabulka den/začátek/konec/pauza, bez editace)
- **Dnešní sloupec** zvýrazněn

---

## 3. Storno politika

### Včasné storno (> nastavená lhůta, default 48h)
- Klient ruší sám, důvod nepovinný
- Plný refund kreditů
- Skóre chování: **-3** (TIMELY_CANCEL)

### Pozdní storno (< nastavená lhůta)
- Klient může zrušit, ale musí zadat důvod (min. 10 znaků)
- Recepce/admin rozhodne o případném poplatku
- Skóre chování: **-10** (LATE_CANCEL)

### Příliš pozdní storno (< 2 hodiny)
- Klient nemůže zrušit sám
- Pouze RECEPTION/ADMIN může zrušit
- Vytvoří se záznam ve storno evidenci

### Důležité principy
- **Žádný no-show stav** — po uplynutí end_time se CONFIRMED automaticky mění na COMPLETED (hodinový cron)
- **Všechna storna ovlivňují skóre** — žádná výjimka
- **Idempotence** — opakované přepočty nesmí penalizovat vícekrát

### Konfigurovatelné hodnoty (admin settings)
| Nastavení | Default | Popis |
|-----------|---------|-------|
| `clientSelfCancelAllowed` | true | Povolení self-service storna |
| `clientSelfCancelMinHours` | 48 | Min. hodin před termínem pro self-cancel |
| `clientSelfCancelLateReasonHours` | 24 | Práh pro povinný důvod |
| `lateCancelPenalty` | 10 | Kreditová penalizace za pozdní storno |

---

## 4. Skóre chování (Behavior Score)

- Rozsah: **0–100** (default 100)
- Clamped — nikdy neklesne pod 0, nestoupne nad 100

| Událost | Body | Kdy nastane |
|---------|------|-------------|
| LATE_CANCEL | -10 | Pozdní storno (< nastavená lhůta) |
| TIMELY_CANCEL | -3 | Včasné storno |
| ON_TIME | +5 | Klient přišel, termín dokončen |
| POSITIVE_FEEDBACK | +10 | Pozitivní hodnocení od klienta |

- Události zaznamenává ADMIN/RECEPTION/EMPLOYEE přes `POST /behavior/record`
- Používá se pro AI waitlist predikce, riziko storna, re-engagement

---

## 5. Kreditní systém

### Typy transakcí
- **PURCHASE** — klient/staff přidá kredity (platba nebo nadační faktura)
- **USE** — platba za termín z kreditů
- **REFUND** — refund při stornování
- **ADJUSTMENT** — manuální úprava adminem

### Tok
1. Klient zakoupí kredity (nebo nadace zaplatí faktur → auto-credit)
2. Při rezervaci se cena odečte z kreditů
3. Při stornování → refund
4. Zůstatek = součet všech transakcí

### Nadační auto-credit
Když je FOUNDATION_INVOICE označena jako PAID:
- Systém automaticky vytvoří PURCHASE transakci
- Přidá kredity klientovi
- Notifikuje RECEPTION/ADMIN

---

## 6. Fakturace

### Typy faktur
| Typ | Prefix | Popis |
|-----|--------|-------|
| THERAPY_INVOICE | TI | Faktura za terapii |
| FOUNDATION_INVOICE | FI | Nadační faktura |
| GENERAL | INV | Obecná faktura |
| PRICE_QUOTE | PQ | Cenová nabídka |

### Číslo faktury
Formát: `{PREFIX}-{YYYY}-{NNNN}` (např. TI-2026-0001)

### Stavy faktury
```
DRAFT → SENT → PAID (nebo OVERDUE / CANCELLED)
```

### Automatické procesy
- **Invoice Overdue** — cron 03:00: SENT faktury po splatnosti → OVERDUE
- **Payment Reminder** — cron 09:00: upomínka po splatnosti (max 3 upomínek)

### Generování z rezervací
- `GET /appointments/uninvoiced` — nefakturované dokončené termíny
- `POST /invoices/from-appointments` — hromadné vytvoření faktur

### Admin stránka: `/admin/invoices`
- Filtr podle typu (Terapie / Pojišťovna / Nadace / Obecné)
- Filtr podle stavu
- Přehled: zaplaceno / čeká / po splatnosti
- Generování z rezervací, ruční vytvoření, CSV export, PDF stažení

---

## 7. Pojišťovací fakturace (DASTA)

### Pojišťovny
- Správa zdravotních pojišťoven (kód, název, kontakt)
- Import výchozích českých pojišťoven

### Výkony (VZP kódy)
- Kód, název, body, cena za bod, limity (max/den, max/měsíc)
- Mapování: služba → výkon (many-to-many)

### Insurance claims
- Záznamy o provedených výkonech: appointment, výkon, diagnóza (ICD-10), částka
- Stavy: UNBILLED → GENERATED → SENT → PAID / REJECTED

### Dávky (DASTA XML)
1. Admin vybere období (měsíc) a pojišťovnu
2. Systém vygeneruje DASTA XML ze všech UNBILLED claimů
3. Export/odeslání pojišťovně
4. Sledování stavu dávky

### Admin stránka: `/admin/insurance`
- Tab "Pojišťovny" — CRUD správa pojišťoven
- Tab "Fakturace pojišťovnám" — dashboard, generování dávek, tabulka claimů
- Link na "Výkony a kódy"

---

## 8. Věrnostní systém (Loyalty Points)

| Událost | Body |
|---------|------|
| Dokončený termín | +10 |
| Zaplacená faktura | +5 |
| Narozeniny | +100 (cron 08:00) |

- Body nikdy neklesají (jen přibývají)
- Žebříček nejlepších klientů (admin/reception)
- Budoucí: odměny za body

---

## 9. Notifikační systém

### Typy
- APPOINTMENT_CONFIRMED, APPOINTMENT_REMINDER, APPOINTMENT_CANCELLED
- WAITLIST_AVAILABLE, INVOICE, GENERAL

### Kanály
- **In-App** — uloženo v DB, zobrazeno v `/notifications`
- **Email** — přes SMTP (opt-in)
- **SMS** — přes SMSAPI (opt-in)
- **Push** — Web Push API (opt-in)

### Upomínky
- 24h před termínem + 2h před termínem
- Scheduler kontroluje každých 5 minut

### Preference
Uživatel si volí: emailReminders, smsReminders, pushReminders (boolean)

---

## 10. Waitlist

### Stav
```
WAITING → NOTIFIED → BOOKED
       → CANCELLED
```

### Tok
1. Klient vytvoří požadavek: služba, preferovaný terapeut/datum
2. Když se uvolní slot → RECEPTION/systém notifikuje
3. Klient potvrdí → rezervace

### Auto-offer (cron každých 6h)
- Pro každý nový otevřený slot: najdi čekající klienty pro danou službu
- Odešli notifikaci "Volný termín"
- Aktualizuj stav na NOTIFIED

---

## 11. Lékařské zprávy a šablony

### Typy zpráv
- **Intake Report** — první návštěva, baseline
- **Progress Report** — průběžný stav
- **Final Report** — konec terapie, shrnutí
- **Cognitive Assessment** — specializované hodnocení

### Šablony
- Kategorie: intake, progress, final, cognitive
- JSON struktura s typovanými poli (text, rating, checkbox)
- Terapeut vytváří zprávu ze šablony, vyplní, finalizuje (DRAFT → FINAL)

---

## 12. Domácí cvičení (Homework)

1. Terapeut přiřadí: název, popis, cviky (JSON), video/média, deadline
2. Notifikace klientovi: "Nové domácí cvičení"
3. Klient zobrazí, dokončí, přidá poznámky
4. Terapeut sleduje pokrok

### Knihovna cvičení
- Databáze cviků s popisem a médii
- Terapeut vybírá z knihovny při přiřazování

---

## 13. Skupiny podpory (Community)

- Skupiny s moderátorem (terapeut/admin)
- Témata a diskuze
- Anonymní příspěvky
- **Krizová detekce** — skenuje příspěvky na varovná klíčová slova ("sebevražda", "nechci žít" atd.), automaticky alertuje admina

---

## 14. Intenzivní pobyty

- Vícedenní rehabilitační programy
- Kapacita, cena, ubytování, strava, program
- Stavy: DRAFT → PUBLISHED → FULL → COMPLETED
- Přihlášení klientů (ENROLLED / WAITLIST / CANCELLED)

---

## 15. Dárkové vouchery

1. Admin/recepce vytvoří voucher: částka, příjemce, platnost (default 1 rok)
2. Systém vygeneruje 12-znakový hex kód
3. Kód odeslán příjemci emailem
4. Příjemce (klient) vloží kód → kredity na účet

---

## 16. FIO Bank párování

### Tok
1. Transakce importovány z FIO Bank API nebo ručně
2. Systém porovná variabilní symbol s číslem faktury
3. Pokud částka souhlasí (±1 Kč): faktura → PAID
4. U nadačních faktur: automatický credit klientovi

---

## 17. GDPR

### Souhlas
- Typy: health_data, marketing, analytics
- Sledování udělení/odvolání s IP a timestamp

### Přístupový log
- Kdo přistoupil ke zdravotním záznamům klienta (kdo, kdy, akce)

### Výmaz (Right to be Forgotten)
1. Klient podá žádost
2. Admin schválí
3. Systém anonymizuje: jméno → "Anonymní uživatel", email → anon_*, smaže zdravotní záznamy, lékařské zprávy, push subscriptions

---

## 18. Firemní wellness (Corporate)

- B2B programy pro firmy
- Správa firemních účtů a zaměstnanců
- Hromadné vouchery

---

## 19. AI Waitlist

- ML predikce konverze waitlistu
- Vstupní data: behavior score, délka čekání, historie rezervací, storna, hodnocení
- Výstup: pravděpodobnost konverze (0–100%), doporučení "Notifikovat / Čekat"

---

## 20. Monitoring a systém

### Automatické úlohy (Scheduler)

| Čas | Úloha | Popis |
|-----|-------|-------|
| `0 * * * *` | complete-therapies | CONFIRMED po end_time → COMPLETED |
| `0 3 * * *` | invoice-overdue | SENT faktury po splatnosti → OVERDUE |
| `0 9 * * *` | payment-reminder | Upomínka na nezaplacené faktury (max 3×) |
| `*/5 * * * *` | appointment-reminders | Upomínky 24h a 2h před termínem |
| `0 8 * * *` | birthday-loyalty | +100 bodů za narozeniny |
| `0 */6 * * *` | waitlist-auto-offer | Nabídka volných slotů čekatelům |

### Admin stránky
- **Dashboard** (`/admin`) — přehled klíčových metrik, rychlé akce
- **BI Dashboard** (`/admin/bi`) — trendy, retence, prognózy, export CSV
- **Statistiky** (`/admin/stats`) — KPI karty, donut chart, top služby/terapeuti
- **Heatmap** (`/admin/heatmap`) — vytíženost místností/terapeutů
- **Monitoring** (`/admin/monitoring`) — zdraví systému, logy, chyby
- **Audit log** (`/admin/audit`) — všechny systémové akce
- **Nastavení** (`/admin/settings`) — veškerá systémová konfigurace

---

## 21. PWA funkce

- **Manifest** — standalone mód, theme color, ikony
- **Service Worker** — offline stránka, cache
- **Push notifikace** — Web Push API s VAPID klíči
- **Instalace** — PWAInstallButton na login (Android nativní, iOS step-by-step)
- **Pull-to-refresh** — nativní feel na mobilech
- **Haptic feedback** — vibrace při akcích (formuláře, tlačítka)
- **Safe areas** — podpora iPhone notch

---

## 22. Navigace podle role

### CLIENT (Bottom Tab Bar)
Přehled | Rezervovat | Termíny | Zprávy | Více (credits, progress, homework, waitlist, health-record, packages, invoices, questionnaires, groups, settings, GDPR)

### RECEPTION (Sidebar)
- Přehled: Dashboard
- Rezervace: Kalendář, Rezervace, Harmonogram, Pracovní hodiny
- Klienti: Klienti, Zdravotní záznamy, Waitlist
- Finance: Billing, Žádosti o kredit

### EMPLOYEE (Sidebar)
Kalendář, Termíny, Lékařské zprávy, Šablony zpráv, Domácí cvičení, Moji klienti, Kolegové, Šablony poznámek, Knihovna cvičení, Můj wellbeing

### ADMIN (Sidebar)
- Přehled: Dashboard, BI Dashboard, Statistiky, Heatmap
- Správa: Rezervace, Uživatelé, Služby, Místnosti, Balíčky, Dotazníky, Skupiny, Vouchery, Firemní wellness, Slevy mimo špičku
- Finance: **Fakturace**, Platby a párování, **Pojišťovny**, Žádosti o kredit
- Nástroje: AI Waitlist
- Systém: Automatizace, Monitoring, Relace, API klíče, GDPR, Audit log, Lékařské zprávy, Hromadné notif., Systémové nastavení, Wellbeing týmu

### Sdílené
Schránka (notifikace), Zprávy, Nastavení účtu

---

## 23. Databázové schéma (klíčové tabulky)

| Oblast | Tabulky |
|--------|---------|
| Uživatelé | users, refreshTokens, passwordResets, loginHistory, apiKeys |
| Rezervace | appointments, appointmentSeries, workingHours, timeOffBlocks, appointmentTemplates, appointmentRatings, openSlots, pendingBookings |
| Služby | services, packages, serviceProcedureMapping |
| Finance | creditTransactions, invoices, invoiceItems, creditRequests, fioTransactions, vouchers |
| Zdraví | healthRecords, medicalReports, therapyTemplates, therapyReports, healthGoals |
| Pojištění | insuranceCompanies, insuranceProcedures, insuranceClaims, insuranceBatches |
| Waitlist | waitlist |
| Notifikace | notifications, notificationPreferences, notificationLog |
| Chování | behaviorEvents, loyaltyPoints, wellbeingSurveys |
| Skupiny | supportGroups, groupMemberships, groupTopics, groupPosts, groupReports |
| Cvičení | homework, exerciseLibrary |
| Intenzivní | intensiveBlocks, intensiveBlockEnrollments |
| GDPR | gdprConsents, gdprErasureRequests, healthRecordAccessLog |
| Systém | systemSettings, auditLog, messages, clientStaffNotes, emergencyContacts, sosActivations |

---

## 24. Deploy

- **VPS:** 109.123.243.52 (Contabo)
- **Stack:** Docker Compose — nginx (reverse proxy + SSL) → web (Next.js :3000) + api (Fastify :3001)
- **DB:** SQLite na disku (`/app/data/pristav.db`)
- **Deploy:** `cd /opt/pristav && git pull && docker compose up -d --build`
- **SSL:** Let's Encrypt certbot
- **Doména:** pristav-radosti.cz (WordPress na Apache) + PWA na IP

---

## Changelog

| Datum | Změna |
|-------|-------|
| 2026-03-29 | Harmonogram: kalendářní týdenní grid s barvami podle terapeuta, pracovní doba read-only |
| 2026-03-29 | Booking: custom měsíční kalendář s % obsazeností, barevné kódování dnů, filtr po kliknutí |
| 2026-03-29 | Oprava 12 selhávajících E2E testů (splash screen timing, stale selektory) |
| 2026-03-29 | Odstraněn UNJUSTIFIED_CANCEL / no-show — jednotná storno politika |
| 2026-03-29 | Sloty: EMPLOYEE nemá přístup, ADMIN+RECEPTION sdílí `/reception/schedule` |
| 2026-03-29 | Nová standalone `/admin/invoices` stránka |
| 2026-03-29 | Pojišťovací fakturace sloučena do `/admin/insurance` (taby) |
| 2026-03-29 | Visual bug fixy: undefined%, oříznutý text, zero-value chart bars |
| 2026-03-29 | E2E visual regression testy integrované do admin-extra + client-extra |
