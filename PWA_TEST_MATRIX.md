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

### K. iPhone / mobilní vizuální QA (layout, přetečení, safe area)

**Cíl:** odhalit vizuální nepřesnosti na iPhonu (přetečení textu, horizontální posuv celé stránky, grafy/tabulkové bloky, safe area u PWA), které funkční E2E nemusí zachytit.

**Prostředí průchodu**

- **Safari** (běžný tab) a **PWA z plochy** (standalone) — chování safe area a výšky viewportu se liší.
- **Portrait** jako hlavní scénář; jednou zkontrolovat **landscape** v Safari (uživatel může otočit zařízení i při `portrait` v manifestu).
- **Světlý + tmavý** motiv aplikace.
- **Volitelně P1:** iOS *Zobrazení* → větší text (Dynamic Type) u dlouhých českých řetězců.

**Checklist na každé zkontrolované stránce**

| Kontrola | OK když | Bug signál |
|----------|---------|------------|
| Horizontální scroll stránky | Stránka jako celek se neposouvá do stran | „Široký“ layout, únik mimo viewport |
| Flex/grid a dlouhý text | E-mail, jméno, číslo faktury se zalomí nebo ellipsis + plný text v tooltipu/title | Rozbitý řádek, překryv sousedních buněk |
| Fixní / plovoucí prvky | Spodní navigace, SOS, toasty, modály nezakrývají obsah a CTA | Useknuté tlačítko nebo pole |
| Safe area | Obsah a CTA nad home indikátorem / mimo výřez | Text nebo tlačítko v „černém pruhu“ |
| Tabulky a široké bloky | Horizontální scroll jen uvnitř karty/tabulkového wrapperu | Celá obrazovka scrolluje do stran |
| Grafy / statistiky | Legendy a osy uvnitř kontejneru, čitelné na úzké šířce | Ořezaný graf, překryvy |

**Šablona zápisu bugu (pro issue / tabulku)**

- Route (URL), role (`CLIENT` / `RECEPTION` / …)
- Režim: Safari vs. PWA standalone
- Verze iOS, model (např. iPhone 13, 15 Pro)
- Screenshot nebo krátké video
- Očekávání vs. skutečnost (1–2 věty)

**Scénáře v matici (mapování na route)**

| ID | Priorita | Role / zaměření | Route (min. sada) | Automatizace | Tagy |
|---|---|---|---|---|---|
| IOS-VIS-01 | P0 | CLIENT — jádro | `/client`, `/client/booking`, `/client/appointments`, `/client/credits`, `/client/invoices`, `/notifications` | manual + playwright (overflow smoke) | @ios @visual |
| IOS-VIS-02 | P0 | CLIENT — grafy / progress | `/client/progress` (+ reporty pokud role používá) | manual + playwright | @ios @visual @performance |
| IOS-VIS-03 | P0 | RECEPTION | `/reception`, `/reception/calendar`, `/reception/clients`, `/reception/billing`, `/reception/waitlist` | manual + playwright | @ios @visual |
| IOS-VIS-04 | P0 | EMPLOYEE | `/employee`, `/employee/appointments`, `/employee/reports`, `/employee/homework` | manual + playwright | @ios @visual |
| IOS-VIS-05 | P1 | ADMIN — široké tabulky / BI | `/admin`, `/admin/users`, `/admin/stats`, `/admin/bi`, `/admin/notifications` | manual + playwright | @ios @visual |
| IOS-VIS-06 | P1 | Společné | `/login`, `/settings` (po přihlášení), modály s formulářem + **otevřená klávesnice** | manual | @ios @visual @auth |

**Automatizace v repu:**
- `apps/web/e2e/iphone-layout-smoke.spec.ts` — `document`/`body` vs. šířka viewportu.
- `apps/web/e2e/iphone-visual-audit.spec.ts` — průchod route: prvky v `<main>` nesmí přesahovat viewport mimo větve s `overflow-x: auto|scroll`; login bez přetečení. Spouštět stejně jako smoke (`--project=setup --project=iphone`).

**Opt-in vizuální snapshoty (P1, před releasem):** při `ENABLE_IPHONE_VISUAL_SNAPSHOTS=1` stejný soubor pořídí baseline screenshoty `/login` a `/client` (může být citlivé na fonty/CI — používat hlavně lokálně nebo jako release krok).

**Go-live doplněk (doporučení)**

- P0: vizuální průchod **IOS-VIS-01** a **IOS-VIS-03** na **fyzickém iPhonu** nebo přes **BrowserStack Live** (**BS-LIVE-01**, **BS-LIVE-02** — sekce **L**) v režimu **Safari** a kde jde **PWA z plochy**.
- Playwright: projekt `iphone` včetně `iphone-layout-smoke` musí být zelený při release buildu; volitelně **BS-AUTO-01** na reálném zařízení v cloudu.

**Postup manuálního průchodu (pro každou roli zvlášť)**

1. Přihlásit se na iPhonu (Safari nebo PWA), projít route z tabulky IOS-VIS pro danou roli.
2. Na každé stránce projít řádky v tabulce „Checklist na každé zkontrolované stránce“ (horizontální scroll, text, fixní prvky, safe area, tabulky, grafy).
3. Přepnout světlý/tmavý motiv a zopakovat u stránek s grafy nebo složitým layoutem.
4. U formulářů zkontrolovat otevření klávesnice (pole zůstane viditelné, tlačítko odeslání dosažitelné).
5. Zapsat nálezy podle šablony zápisu bugu; každý nález = samostatný layout/CSS úkol.

### L. BrowserStack (reálná zařízení v cloudu)

**Účel:** doplnit lokální Playwright (`iphone` = emulovaný WebKit) o **skutečný Safari na fyzickém iPhonu/iPadu** v cloudu — správné **safe area**, fonty, gesta, část chování **PWA** a síťové podmínky. Oficiální návod: [Playwright on BrowserStack (Node.js)](https://www.browserstack.com/docs/automate/playwright/getting-started/nodejs).

**Účet a tajemství**

- Přihlašovací údaje: **`BROWSERSTACK_USERNAME`** a **`BROWSERSTACK_ACCESS_KEY`** (Dashboard → Account) — ukládej do **GitHub Actions secrets** / správce tajemství, nikdy do repa.
- Volitelně **`BROWSERSTACK_BUILD_NAME`** / tagy buildu pro filtrování v Automate dashboardu.

**Dostupnost aplikace z cloudu BrowserStack**

- Automatizované testy běží na strojích BrowserStack — musí umět načíst **`BASE_URL`** (stejně jako dnešní E2E proti VPS).
- **Veřejná HTTPS URL** je nejbezpečnější volba (certifikát, mixed content, cookies `Secure` podle nasazení).
- Je-li aplikace jen v privátní síti / localhost: použij **[BrowserStack Local](https://www.browserstack.com/docs/browserstack-local/overview)** (tunel); na VPS s veřejnou IP často stačí přímá URL.
- **Auth rate limit:** BrowserStack používá **jiné egress IP** než váš notebook — při opakovaných loginech držet `E2E_LOGIN_GAP_MS` / na cílovém API dočasně zvýšit limit (viz §8 a `AUTH_LOGIN_RATE_LIMIT_*`).

**Dva režimy použití**

| Režim | K čemu | Poznámka |
|--------|--------|----------|
| **Automate + Playwright** | Regresní běh stejných speců proti reálnému iOS WebKitu | Stejný repozitář: `e2e/iphone-layout-smoke.spec.ts`, `e2e/iphone-visual-audit.spec.ts`, případně zúžený výběr `client.spec.ts` / `reception.spec.ts`. Integrace přes [SDK / `browserstack.yml`](https://www.browserstack.com/docs/automate/playwright/getting-started/nodejs/integrate-your-tests-sdk) nebo [CDP `connect` + capabilities](https://www.browserstack.com/docs/automate/playwright/playwright-capabilities). |
| **Live / App Live** | Ruční průchod checklistu §K (PWA z plochy, klávesnice, Dynamic Type) | Plná instalace PWA a některá gesta nejsou vždy pokryté čistou automatizací; sem patří **IOS-VIS-06** a „Add to Home Screen“. |

**Doporučená zařízení (Automate / Live)**

| Zařízení (příklad capability) | Proč |
|-------------------------------|------|
| **iPhone 15 Pro** (aktuální iOS) | Reference notch / ostrov, nejběžnější cíl |
| **iPhone SE (3. gen.)** nebo nejmenší podporovaná šířka | Regrese úzkého viewportu (komplement k 320px v auditu) |
| **iPad** (volitelně P2) | Admin / kalendář na větší obrazovce |

Konkrétní `os`, `os_version`, `device` dle aktuálního [seznamu zařízení](https://www.browserstack.com/list-of-browsers-and-platforms/automate) v BrowserStack účtu.

**Návrh scénářů (mapování na IOS-VIS + E2E soubory)**

| ID | Priorita | Co spustit / ověřit | Očekávání | Poznámka |
|----|----------|---------------------|-----------|----------|
| **BS-AUTO-01** | P1 | Playwright na BS: `iphone-layout-smoke.spec.ts` na **iPhone 15 Pro** (Safari) proti produkční/staging `BASE_URL` | Stejné jako lokální `iphone`: žádné regrese overflow | První krok adopce BS; build v Automate dashboardu |
| **BS-AUTO-02** | P1 | Stejné prostředí: `iphone-visual-audit.spec.ts` | Všechny audity zelené po deployi | Přísnější kontrola `<main>` |
| **BS-AUTO-03** | P2 | Podmnožina role smoke (např. jen `client.spec.ts` + `reception.spec.ts`) na BS iPhone | Funkční průchod bez timeoutů | Delší běh = plánovat mimo špičku nebo zkrátit sadu |
| **BS-LIVE-01** | P0 | **Live:** přihlášení, **IOS-VIS-01** + **IOS-VIS-03** ručně na zařízení | Checklist §K bez P0 vizuálních vad | Náhrada za „mám fyzický iPhone“ |
| **BS-LIVE-02** | P1 | **Live:** Safari → Sdílet → **Přidat na plochu** → spuštění PWA, kontrola safe area spodní lišty (CLIENT) | Konzistentní s Safari nebo známý rozdíl zdokumentovaný | Automate často neumí plně nahradit |
| **BS-LIVE-03** | P1 | **Live:** formulář (např. login / poznámka) + **otevřená klávesnice** | Žádné skryté CTA | Odpovídá **IOS-VIS-06** |

**Doporučená frekvence**

- **BS-AUTO-01** (nebo 01+02): před major releasem UI nebo 1× týdně naplánovaný workflow (volitelný GitHub Action se secrets `BROWSERSTACK_USERNAME`, `BROWSERSTACK_ACCESS_KEY`).
- **BS-LIVE-01**: před go-live nebo po velké změně layoutu.

**Implementace v repu (volitelný další krok)**

- Přidat `browserstack.yml` + závislost dle oficiálního SDK **nebo** samostatný `playwright.browserstack.config.ts` s projektem `connect` a capabilities pouze když jsou nastavené BS env proměnné — aby lokální běh bez účtu zůstal beze změny. Tento dokument popisuje **proces a rozsah**; konkrétní patch konfigurace lze doplnit samostatným úkolem.

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
- `iphone-layout-smoke` (projekt `iphone` — regrese horizontálního overflow na klíčových route)

### Playwright P1 regression (scheduled/nightly)

- `RC-01`, `RC-02`, `RC-04`
- `EM-01`
- `AD-01`, `AD-02`
- `XR-02`, `XR-03`
- `PERF-01` (synthetic latency profile)
- Volitelně: **BrowserStack** — `BS-AUTO-01` / `BS-AUTO-02` (sekce **L**) proti veřejné `BASE_URL`

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
- iOS vizuál (doporučený P0 před major UI release): `IOS-VIS-01`, `IOS-VIS-03` na fyzickém iPhonu **nebo** **BS-LIVE-01** (BrowserStack Live, sekce **L**); automaticky `pnpm -C apps/web exec playwright test --project=setup --project=iphone e2e/iphone-layout-smoke.spec.ts`; volitelně na cloudu **BS-AUTO-01**

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
pnpm -C apps/api test
```
(Skript už obsahuje `vitest run`; příkaz `pnpm -C apps/api test run` by Vitestu předal filter `run` a nenašel by soubory.)

### Celkové výsledky (2026-03-25, po opravách)
- Vitest: **652/652 passed**
- Playwright E2E (chromium + webkit + iphone + android): **~714 passed, ~2 flaky, ~2 skipped**
- Celková doba: ~13 minut

### iPhone visual audit (`main` + login, přísnější než smoke)
```bash
BASE_URL=http://109.123.243.52 \
NEXT_PUBLIC_API_URL=http://109.123.243.52/api \
E2E_LOGIN_GAP_MS=500 \
pnpm -C apps/web exec playwright test --project=setup --project=iphone e2e/iphone-visual-audit.spec.ts
```

### Jen iPhone layout smoke (overflow)
```bash
BASE_URL=http://109.123.243.52 \
NEXT_PUBLIC_API_URL=http://109.123.243.52/api \
E2E_LOGIN_GAP_MS=500 \
pnpm -C apps/web exec playwright test --project=setup --project=iphone e2e/iphone-layout-smoke.spec.ts
```

### BrowserStack Automate (Playwright na reálném iOS)

Po zprovoznění integrace dle [BrowserStack Playwright — Node.js](https://www.browserstack.com/docs/automate/playwright/getting-started/nodejs) (SDK + `browserstack.yml` nebo `connect` + capabilities v projektu):

```bash
export BROWSERSTACK_USERNAME="…"
export BROWSERSTACK_ACCESS_KEY="…"
# Doporučeno HTTPS a veřejná URL; pro privátní síť zapnout BrowserStack Local.
BASE_URL="https://váš-public-host" \
NEXT_PUBLIC_API_URL="https://váš-public-host/api" \
E2E_LOGIN_GAP_MS=500 \
pnpm -C apps/web exec playwright test --project=setup e2e/iphone-layout-smoke.spec.ts
```

Konkrétní `--project` / názvy projektů závisí na tom, jak v konfiguraci Playwright pojmenuješ BrowserStack zařízení (iPhone). Rozsah běhů viz **BS-AUTO-*** v sekci **L**.

Opt-in screenshot baseline (`/login`, `/client`) na projektu `iphone` — první běh s vytvořením referenčních PNG:
```bash
ENABLE_IPHONE_VISUAL_SNAPSHOTS=1 pnpm -C apps/web exec playwright test --project=setup --project=iphone e2e/iphone-layout-smoke.spec.ts --update-snapshots
```
Další běhy bez `--update-snapshots` porovnávají s uloženými baseline.

### Známá omezení
- `offline banner` test: běží jen na Chromium (WebKit nepodporuje CDP offline simulaci).
- `global search` test: přeskočen na mobilní viewportu (sidebar je skrytý).
- Flaky testy: `reception clients page loads with search` a `reception-extra filter buttons` — race condition při načítání stránky, projde při retru.
- **iPhone layout smoke:** Playwright emuluje šířku WebKitu, ne vždy shodně se Safari na zařízení (`env(safe-area-inset-*)` v emulaci často 0). Globální `overflow-x: hidden` může skrýt přetečení — manuální kontrola „nic důležitého není useknuté“ zůstává nutná.
- **BrowserStack:** testy běží z cizích IP — hlídej auth rate limit na API; část PWA scénářů (instalace z plochy, některá gesta) vyžaduje **Live** (sekce **L**, **BS-LIVE-***), ne jen Automate.

