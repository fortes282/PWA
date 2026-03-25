# Komplexní PWA testovací scénáře pro odhalení bugů

## 1) Scope, prostředí, role

- Cílové prostředí: produkční PWA na `pristav-radosti.cz` (instalovaná app, ne jen browser tab).
- Role: `CLIENT`, `RECEPTION`, `EMPLOYEE`, `ADMIN`.
- Cíl: odhalit funkční, integrační, bezpečnostní, výkonové a UX bugy v reálném mobilním provozu.

## 2) Test data & preconditions

- Test účty (seed): admin, recepce, terapeut, klient.
- Primární cílové prostředí pro Playwright E2E: `http://109.123.243.52` (deploy), pokud není výslovně uvedeno jinak.
- Lokální běh (`localhost`) používej jen pro vývoj/debug, ne jako hlavní release validaci.
- Minimálně 3 klienti:
  - klient A: aktivní kredity, existující budoucí termín,
  - klient B: bez kreditů,
  - klient C: čekatel (waitlist).
- Minimálně 2 terapeuti, 2 místnosti, 3 služby s různou délkou.
- Push test zařízení:
  - Android (Chrome + instalovaná PWA),
  - iOS (Safari + Add to Home Screen).
- Síťové profily:
  - online stabilní,
  - offline,
  - pomalá síť / vysoká latence.

### Playwright preflight (povinné před full suitem)

- Ověř dostupnost `BASE_URL/login` v browseru.
- Ověř ruční login pro role `CLIENT`, `RECEPTION`, `EMPLOYEE`, `ADMIN`.
- Spusť nejdřív pouze auth setup (`e2e/auth.setup.ts`).
- Full suite spouštěj až po 100% průchodu auth setupu.
- Pokud setup role zůstane na `/login`, ber to jako blocker (credentials/seed/role access) a full suite nespouštěj.

## 3) Rizikové domény a bug patterns

- `@pwa-lifecycle`: instalace, standalone mód, cache stale assets, update SW, offline/online přechod.
- `@auth`: expirace access tokenu, refresh flow, race během paralelních requestů.
- `@rbac`: přístup na route/API mimo oprávnění role, IDOR přes cizí ID.
- `@booking`: konflikt termínů, double-booking, nekonzistence mezi kalendáři rolí.
- `@notifications`: duplicitní nebo chybějící notifikace, read/unread drift, selhání providerů.
- `@billing`: fakturační chyby, nesedící částky, poškozený PDF export.
- `@data-consistency`: změna v jedné roli nepropíše UI/API v jiné roli.
- `@performance`: pomalé dashboardy, zamrzání na dlouhých seznamech, retry/timeout regrese.
- `@security`: XSS payloady, manipulace parametry, replay/expired token abuse.

## 4) Detailní test matrix

Legenda:
- Priorita: `P0` kritické před releasem, `P1` důležité regresní, `P2` rozšiřující.
- Automatizace: `manual`, `playwright`, `vitest-api`.

### A. PWA platform & device scénáře

| ID | Priorita | Scénář | Kroky (zkráceně) | Očekávaný výsledek | Bug signály | Automatizace | Tagy |
|---|---|---|---|---|---|---|---|
| PWA-01 | P0 | Android install + launch | Otevři web, nainstaluj PWA, spusť z ikonky | App běží standalone, bez browser chrome, session aktivní | Otevře se v tabu, ztracená session, layout glitch | manual + playwright | @pwa @auth |
| PWA-02 | P0 | iOS Add to Home Screen | Přidej na plochu, spusť, přihlas se, kill app, znovu spusť | Session perzistuje dle auth pravidel | Odhlášení po restartu, blank screen | manual | @pwa @auth |
| PWA-03 | P0 | Offline fallback | Přihlaš se, vypni síť, otevři klíčové route | Funkční offline stránka/fallback bez crash | 500/blank, nekonečný spinner | playwright | @pwa @performance |
| PWA-04 | P1 | Reconnect sync | Při offline vytvoř akci (např. draft), pak online | Po reconnectu jasná obsluha stavu, bez duplicit | Duplicitní submit, ztracená akce | manual | @pwa @data-consistency |
| PWA-05 | P1 | Service worker update | Otevři app na verzi N, proveď deploy N+1, refresh/reopen | Nové assety se načtou korektně | Staré JS/CSS, nekompatibilní UI/API | manual | @pwa @performance |

### B. Auth, session, RBAC

| ID | Priorita | Scénář | Kroky | Očekávaný výsledek | Bug signály | Automatizace | Tagy |
|---|---|---|---|---|---|---|---|
| AUTH-01 | P0 | Login/logout happy path | Login každou rolí, logout | Správný redirect dle role, logout invaliduje session | Špatný redirect, přístup po logoutu | playwright | @auth @rbac |
| AUTH-02 | P0 | Access token expiry + refresh | Vyvolej expiraci access tokenu během aktivní práce | Tiché obnovení, uživatel nepřijde o stav | Náhlé odhlášení, 401 loop | playwright + vitest-api | @auth |
| AUTH-03 | P0 | Expired/invalid refresh | Invalidační scénář refresh tokenu | Bezpečné odhlášení na login + info | Tichý fail, nekonečný retry | vitest-api + manual | @auth @security |
| AUTH-04 | P1 | Paralelní request race | Otevři více panelů/akcí při expiraci tokenu | 1 refresh flow, ostatní requesty korektně doběhnou | Vícenásobný refresh, 401 storm | vitest-api | @auth @performance |
| RBAC-01 | P0 | Route protection | Přímý vstup na cizí role route | Redirect/403 dle politiky | Neoprávněný přístup ke stránce | playwright | @rbac @security |
| RBAC-02 | P0 | API authorization | Volání endpointů cizí role | 403, bez úniku dat | 200 s cizími daty | vitest-api | @rbac @security |
| RBAC-03 | P1 | IDOR test | Změna `:id` na cizí entitu | Přístup zamítnut | Editace čtení cizích dat | vitest-api | @security @rbac |

### C. CLIENT role E2E

| ID | Priorita | Scénář | Kroky | Očekávaný výsledek | Bug signály | Automatizace | Tagy |
|---|---|---|---|---|---|---|---|
| CL-01 | P0 | Rezervace termínu | Vyber službu/slot, potvrď rezervaci | Termín vytvořen, viditelný v Moje rezervace | Slot zmizí bez rezervace, duplicitní termín | playwright | @booking @client |
| CL-02 | P0 | Konflikt rezervace | Pokus rezervovat kolidující slot | 409 + jasná hláška | Tichý fail nebo double-booking | playwright + vitest-api | @booking |
| CL-03 | P1 | Storno + důvod | Storno existujícího termínu | Stav zrušen + důvod konzistentně viditelný | Různý stav mezi obrazovkami | playwright | @booking @data-consistency |
| CL-04 | P1 | Kredity historie | Otevři saldo + historii, stránkuj | Částky a stránky sedí | Nesoulad saldo vs historie | playwright | @billing @client |
| CL-05 | P1 | Waitlist přidání | Přidej se na waitlist | Záznam uložen, recepce ho vidí | Nepropíše se do recepce | playwright | @waitlist @data-consistency |
| CL-06 | P2 | Reports/progress načtení | Otevři reporty a progress dashboard | Data konzistentní, bez pádů | 500, prázdné grafy s daty | manual + playwright | @client @performance |

### D. RECEPTION role E2E

| ID | Priorita | Scénář | Kroky | Očekávaný výsledek | Bug signály | Automatizace | Tagy |
|---|---|---|---|---|---|---|---|
| RC-01 | P0 | Calendar + filtr terapeuta | Přepínej týden/měsíc + filtr | Správné sloty podle filtru | Sloty mimo filtr, ztráta dat po přepnutí | playwright | @reception @booking |
| RC-02 | P0 | Vytvoření termínu recepcí | Založ termín klientovi | Termín viditelný klientovi i terapeutovi | Chybí v jedné roli | playwright | @booking @data-consistency |
| RC-03 | P1 | Bulk SMS/email | Odešli bulk zprávu klientům | Odeslání/log + chybové hlášení při failu | Tichý fail, část příjemců bez info | manual + vitest-api | @notifications |
| RC-04 | P1 | Billing report + invoice send | Vygeneruj report, fakturu, odeslat | Částky sedí, odeslání potvrzené | Špatný total, neplatný PDF | manual + playwright | @billing |
| RC-05 | P1 | Waitlist návrh slotu | Nabídni slot čekateli | Notifikace klientovi, stav waitlistu aktualizován | Notifikace bez změny stavu nebo naopak | manual + playwright | @waitlist @notifications |

### E. EMPLOYEE role E2E

| ID | Priorita | Scénář | Kroky | Očekávaný výsledek | Bug signály | Automatizace | Tagy |
|---|---|---|---|---|---|---|---|
| EM-01 | P0 | Day timeline provoz | Otevři timeline, detail termínu, update poznámek | Korektní časová osa + uložené poznámky | Posun času, ztráta poznámek | playwright | @employee @booking |
| EM-02 | P0 | Medical report PDF/DOCX | Vytvoř zprávu a stáhni PDF i DOCX | Oba exporty validní, obsahuje data klienta | Prázdný export, poškozený soubor | manual + playwright | @medical @exports |
| EM-03 | P1 | Přístup k cizím klientům | Pokus otevřít detail mimo oprávnění | Přístup blokován dle RBAC | Únik zdravotních dat | vitest-api + manual | @security @rbac |

### F. ADMIN role E2E

| ID | Priorita | Scénář | Kroky | Očekávaný výsledek | Bug signály | Automatizace | Tagy |
|---|---|---|---|---|---|---|---|
| AD-01 | P0 | Users CRUD + role change | Vytvoř/edituj/deaktivuj/reaktivuj uživatele | Role a status se projeví napříč app | Uživatel má stará oprávnění | playwright + vitest-api | @admin @rbac |
| AD-02 | P1 | Services/Rooms CRUD | Přidej/disable službu a místnost | Konzistentní v booking flow | Inaktivní služba stále rezervovatelná | playwright | @admin @booking |
| AD-03 | P1 | Stats dashboard | Ověř agregace výnosů/obsazenosti | Hodnoty konzistentní s daty | Nesedící měsíce, negativní výnosy | manual + vitest-api | @admin @performance |
| AD-04 | P1 | FIO export/matching | Export CSV + match plateb | CSV validní (BOM/diakritika), match mění stav | Rozbitý CSV formát, nedeterministický match | manual + vitest-api | @billing @exports |

### G. Cross-role integrační scénáře

| ID | Priorita | Scénář | Kroky | Očekávaný výsledek | Bug signály | Automatizace | Tagy |
|---|---|---|---|---|---|---|---|
| XR-01 | P0 | CLIENT booking -> RECEPTION/EMPLOYEE view | Klient rezervuje, ostatní role ověří | Okamžitá konzistence statusu a detailu | Stav nesedí mezi rolemi | playwright | @data-consistency @booking |
| XR-02 | P0 | RECEPTION storno -> CLIENT notify | Recepce storno + důvod | Klient vidí důvod + notif | Storno bez notifikace/důvodu | playwright | @notifications @booking |
| XR-03 | P1 | EMPLOYEE report -> CLIENT reports | Terapeut uloží report | Klient report vidí bez prodlevy/chyby | Report existuje jen v jedné roli | playwright | @data-consistency @medical |

### H. Notifications (in-app/email/SMS/push)

| ID | Priorita | Scénář | Kroky | Očekávaný výsledek | Bug signály | Automatizace | Tagy |
|---|---|---|---|---|---|---|---|
| NT-01 | P0 | In-app unread/read/clear-read | Vytvoř notif, označ přečtené, clear-read | Badge a seznam konzistentní | Badge count nesedí | playwright + vitest-api | @notifications |
| NT-02 | P1 | Push permission denied | Zamítni push, vyvolej událost | Graceful fallback (in-app/email/SMS) | Chyba blokuje celý flow | manual | @pwa @notifications |
| NT-03 | P1 | Provider outage (SMTP/SMS) | Simuluj fail provideru | Retry/hláška/log, bez pádu UI | Tichá ztráta zprávy | vitest-api + manual | @notifications @reliability |
| NT-04 | P1 | Deduplikace | Vyvolej stejnou událost vícekrát | Bez duplicitních notifikací | Duplicity v inboxu | vitest-api | @notifications |

### I. Security & abuse scénáře

| ID | Priorita | Scénář | Kroky | Očekávaný výsledek | Bug signály | Automatizace | Tagy |
|---|---|---|---|---|---|---|---|
| SEC-01 | P0 | XSS payload v notes/search | Vlož script payloady | Payload escapován, bez execution | Spuštění JS/XSS alert | vitest-api + manual | @security |
| SEC-02 | P0 | JWT manipulation/replay | Pošli starý/altered token | 401/403, žádná data | Přijetí manipulovaného tokenu | vitest-api | @security @auth |
| SEC-03 | P1 | Brute force/rate limit | Opakované login pokusy | Rate limit/lockout chování dle policy | Neomezené pokusy | vitest-api | @security @auth |
| SEC-04 | P1 | Sensitive data leakage | Kontrola error payloadů | Bez úniku stacktrace/secrets | Interní detaily v response | vitest-api | @security |

### J. Performance & reliability scénáře

| ID | Priorita | Scénář | Kroky | Očekávaný výsledek | Bug signály | Automatizace | Tagy |
|---|---|---|---|---|---|---|---|
| PERF-01 | P0 | Dashboard under latency | Omez síť, načti dashboardy rolí | Graceful loading + timeout handling | Freeze UI, nekonečné skeletony | manual + playwright | @performance |
| PERF-02 | P1 | Paginace velkých seznamů | Test page/limit/search kombinace | Bez duplicit/výpadků položek | Přeskakující nebo duplikované řádky | vitest-api + playwright | @performance |
| PERF-03 | P1 | Long session stability | Dlouhá práce v PWA (30-60 min) | Bez memory leak, bez degradace UX | Postupné zpomalování/crash | manual | @performance @pwa |

## 5) Automatizační mapování (P0/P1)

### Standardní E2E runbook (deploy-first)

1. Auth setup:
   - `BASE_URL="http://109.123.243.52" pnpm -C apps/web exec playwright test e2e/auth.setup.ts --project=setup`
2. Full Playwright suite:
   - `BASE_URL="http://109.123.243.52" pnpm -C apps/web test:e2e`
3. Při failu setupu přilož artefakty (`test-results/**`: screenshot, video, `error-context.md`) a eskaluj jako release blocker.

**Rate limit login (API):** `POST /auth/login` má default **10 požadavků / 5 min / IP** (`AUTH_LOGIN_RATE_LIMIT_MAX`, `AUTH_LOGIN_RATE_LIMIT_WINDOW` v `apps/api/src/routes/auth.ts`). Na stagingu lze zvednout (např. `docker-compose.staging.yml`). Auth setup je **jeden** Playwright test se 4 rolemi v řadě; `auth.spec` už zbytečně nevolá `login()` pro každou roli (používá uložený storage z setupu). Mezi rolemi v setupu je `E2E_LOGIN_GAP_MS` (default odvozený od limitu, cca **30,25 s**) a `clearSessionForNextLogin`. Pro rychlejší lokální běh: `E2E_LOGIN_GAP_MS=2000` (jen pokud API limit dovolí).

### Playwright P0 smoke (run on each PR + pre-release)

- `AUTH-01`, `AUTH-02`, `RBAC-01`
- `CL-01`, `CL-02`
- `PWA-03`
- `XR-01`
- `NT-01`

### Playwright P1 regression (scheduled/nightly)

- `RC-01`, `RC-02`, `RC-04`
- `EM-01`
- `AD-01`, `AD-02`
- `XR-02`, `XR-03`
- `PERF-01` (synthetic latency profile)

### Vitest/API P0-P1

- `AUTH-02`, `AUTH-03`, `AUTH-04`
- `RBAC-02`, `RBAC-03`
- `SEC-01`, `SEC-02`, `SEC-03`, `SEC-04`
- `NT-03`, `NT-04`
- `PERF-02`

## 6) Go-live gate (must pass)

- PWA životní cyklus: `PWA-01`, `PWA-03`
- Auth + RBAC: `AUTH-01`, `AUTH-02`, `RBAC-01`, `RBAC-02`
- Booking core: `CL-01`, `CL-02`, `XR-01`
- Notifikace core: `NT-01`
- Billing/export sanity: `RC-04` nebo `AD-04` (aspoň jeden plný fakturační/exportní průchod)
- Security sanity: `SEC-01`, `SEC-02`

Release je blokovaný, pokud selže jakýkoliv `P0` scénář nebo pokud `go-live gate` neprojde 100 %.

## 7) Doporučený test run order

1. P0 smoke (rychlé zachycení kritických regresí).
2. Cross-role P1 regresní flow.
3. Security a performance batche.
4. P2 exploratory (device-specific UX a delší stability běhy).

## 8) Playwright E2E — kompletní spuštění na VPS (http://109.123.243.52)

### Prerekvizity na VPS
VPS musí mít v `/opt/pristav/.env`:
```
CI=true                        # vypíná rate limiting v API
JWT_EXPIRES_IN=2h              # tokeny musí přežít celý test run (~13 min)
AUTH_LOGIN_RATE_LIMIT_MAX=1000
```
Po změně `.env` je nutné restartovat API:
```bash
cd /opt/pristav && docker compose up -d --force-recreate api
```

### Spuštění celého suitu
```bash
# Z kořene repozitáře:
BASE_URL=http://109.123.243.52 \
NEXT_PUBLIC_API_URL=http://109.123.243.52/api \
E2E_LOGIN_GAP_MS=500 \
pnpm -C apps/web exec playwright test
```

### Jen auth setup (ověření přihlašovacích údajů)
```bash
BASE_URL=http://109.123.243.52 \
NEXT_PUBLIC_API_URL=http://109.123.243.52/api \
E2E_LOGIN_GAP_MS=500 \
pnpm -C apps/web exec playwright test --project=setup
```

### Spuštění jednoho projektu (např. chromium)
```bash
BASE_URL=http://109.123.243.52 \
NEXT_PUBLIC_API_URL=http://109.123.243.52/api \
E2E_LOGIN_GAP_MS=500 \
pnpm -C apps/web exec playwright test --project=setup --project=chromium
```

### Spuštění Vitest API testů
```bash
pnpm -C apps/api test run
```

### Celkové výsledky (2026-03-25, po opravách)
- Vitest: **652/652 passed**
- Playwright E2E (chromium + webkit + iphone + android): **~714 passed, ~2 flaky, ~2 skipped**
- Celková doba: ~13 minut

### Známá omezení
- `offline banner` test: běží jen na Chromium (WebKit nepodporuje CDP offline simulaci).
- `global search` test: přeskočen na mobilní viewportu (sidebar je skrytý).
- Flaky testy: `reception clients page loads with search` a `reception-extra filter buttons` — race condition při načítání stránky, projde při retru.

