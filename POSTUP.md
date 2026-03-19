# POSTUP.md — Pristav Radosti v2

## NOC 35 — UX Overhaul & Feature Enrichment

**Testy: 652/69 (všechny zelené) | Lint: 0 warningů | Frontend build: OK | Push: OK**

**1. UX P1 — Mobile Bottom Tab Bar (CLIENT)**
- Nový bottom tab bar pro CLIENT na mobilu: Přehled | Rezervovat | Termíny | Zprávy | Více
- "Více" otevírá bottom sheet s dalšími položkami (Kredity, Pokrok, Faktury, Nastavení…)
- Nahrazuje nevhodný hamburger/chevron menu
- `min-h-[44px]` na všech touch targetech v navigaci
- Hamburger icon → Menu/X icon pro non-CLIENT role
- Safe area padding pro iOS (`env(safe-area-inset-bottom)`)

**2. UX P1 — Nav Groups (ADMIN/RECEPTION)**
- Sidebar navigace pro ADMIN seskupena do sekcí: Přehled, Správa, Finance, Nástroje, Systém
- RECEPTION nav seskupena: Přehled, Termíny, Klienti, Finance
- Tiny uppercase group headers `text-[10px]`

**3. UX P1 — PWA Install Prompt**
- `usePWAInstall` hook — `beforeinstallprompt` handler + `appinstalled` detection
- `PWAInstallBanner` — zobrazí se po 2. návštěvě, dismissable, uloženo v localStorage
- Positioned above bottom tab bar on mobile

**4. UX P1 — Hero "Příští termín" Card**
- Gradient teal karta na client dashboard s příštím termínem
- Zobrazuje countdown (za X dní/hodin), službu, terapeuta
- Tlačítko "Připojit se" pro online sezení

**5. UX P1 — Onboarding Checklist**
- `OnboardingChecklist` komponenta pro nové klienty
- 3 kroky: zdravotní karta, notifikace, první rezervace
- Progress bar, dismissable, link na každý krok
- Automaticky zmizí po splnění všech kroků

**6. UX P1 — Card-Based Booking + Progress Stepper**
- Výběr služby přes interaktivní karty místo `<select>` dropdown
- Vizuální 4-step progress stepper: Služba → Datum → Čas → Potvrzení
- Animované přechody mezi kroky (`animate-slide-in`)
- Post-booking success screen s doporučeními (zdravotní karta, SMS)
- Back navigation tlačítka

**7. UX P2 — Brand Color Teal**
- Primary color palette přepnuta z blue (#2563eb) na teal (#0d9488)
- Manifest `theme_color` + `background_color` → #0d9488
- Viewport `themeColor` → #0d9488
- Tailwind config: teal-based primary shades

**8. COULD #12 — Terapeut Wellbeing Monitoring**
- DB: wellbeing_surveys tabulka (5 otázek, average score, trend)
- API: POST /wellbeing/survey — týdenní self-check (upsert per week)
- API: GET /wellbeing/my-history — 12-týdenní trend, tipy
- API: GET /wellbeing/team-overview — admin anonymizovaný přehled, přesčasy, caseload
- FE: /employee/wellbeing — self-check formulář, line chart trendu
- FE: /admin/staff-wellbeing — týmový dashboard, alerting

**9. COULD #14 — Domácí Cvičení (Homework)**
- DB: homework tabulka s exercises (JSON), video_url, due_date
- API: POST/GET/PATCH/DELETE /homework — přiřazení, status, completion
- Strukturované cviky: název, série, opakování, trvání, poznámky
- Notifikace klientovi při přiřazení
- FE: /client/homework — přehled cvičení, mark-as-complete, videa
- FE: /employee/homework — formulář pro přiřazení, seznam
- Nav: Domácí cvičení pro CLIENT i EMPLOYEE

**10. Lint & Test Fixes**
- push-vapid.test.ts: doplněny nové DB sloupce (totp, insurance, GDPR)
- therapy-reports detail: opraveny react-hooks/exhaustive-deps warnings
- useOfflineSync: odstraněny unused imports
- booking page: opraveny duplicate imports

**Statistiky projektu (NOC 35):**
- ~65 000 řádků TypeScript kódu
- 56 API route souborů / ~220+ endpointů
- 74 frontend stránek
- 69 testových souborů / 652 testů

---

## NOC 34 — Public Health Monitor Workflow

**Validace: `bash -n` monitor script PASS | mock health monitor PASS (OK/WARNING/CRITICAL JSON) | workflow/docs updated | Push: pending**

**1. JSON output pro monitor-health**
- `scripts/monitor-health.sh` nově podporuje `MONITOR_JSON=1`
- Vrací strukturovaný JSON payload vhodný pro CI, artifacty a strojové zpracování
- Zachovány návratové kódy `0=OK`, `1=warning`, `2=critical`
- Doplněna robustnější obsluha chyb: ping fail, fetch fail, invalid JSON z `/health/detailed`

**2. GitHub Actions public monitor**
- Přidán `.github/workflows/public-health-monitor.yml`
- Spouštění každých 15 minut + ruční `workflow_dispatch`
- Konfigurace přes repo/environment vars: `MONITOR_BASE_URL`, volitelně `MONITOR_MAX_DB_LATENCY_MS`, `MONITOR_FAIL_ON_DEGRADED`, `MONITOR_WARN_IF_PENDING_REMINDERS_GT`
- Workflow ukládá `monitor-summary.json` jako artifact a vypisuje přehled do GitHub Step Summary

**3. Dokumentace**
- `README.md`: doplněn popis public health monitor workflow a JSON režimu monitor skriptu
- `DEPLOY.md`: doplněno použití `MONITOR_JSON=1` a postup pro GitHub Actions public monitor

**4. Co zbývá**
- Nastavit GitHub repo/environment variable `MONITOR_BASE_URL` na reálnou staging/production URL
- Po deployi ověřit první scheduled/manual běh workflow proti veřejné instanci
- Stále zbývá samotné nasazení na VPS/Render a první reálné smoke/monitor běhy

## NOC 33 — Hosted Deploy Smoke Workflow Finalization

**Validace: smoke verify PASS (12/12) | Lint: OK | YAML parse: OK | Push: OK**

**1. GitHub Actions workflow pro veřejný deploy smoke**
- Přidán `.github/workflows/deploy-smoke.yml` — ručně spustitelný workflow **Deploy Smoke Verify**
- Vstupy: `base_url`, volitelně `api_url`, `expected_version`, `allow_http`
- Používá existující `pnpm smoke:verify` a ukládá `smoke-summary.json` jako artifact
- Přidána preflight kontrola na secrets `SMOKE_ADMIN_EMAIL` a `SMOKE_ADMIN_PASSWORD`, aby workflow failnul srozumitelně

**2. Dokumentace workflow použití**
- `README.md`: doplněno, že smoke verify lze spouštět i přes GitHub Actions bez shell přístupu na server
- `DEPLOY.md`: doplněny požadované secrets a odkaz na workflow jako vzdálený post-deploy check

**3. Dnes dokončeno / co zbývá**
- Dokončeno: deploy smoke tooling je nyní použitelné lokálně, z CI i manuálně přes GitHub Actions
- Zbývá: nastavit repo/environment secrets a poprvé workflow spustit proti reálnému staging/production URL
- Zbývá: samotné nasazení na VPS/Render a první reálný smoke run po deployi

## NOC 32 — Deployment Smoke & Monitoring Automation

**Validace: bash syntax OK | `node scripts/verify-deploy.mjs --help` OK | Docs updated | Commit: hotovo**

*(archivováno — viz git history)*

---

## Archivní stavy (NOC 8–31)

Viz předchozí verze POSTUP.md (Git history).

---

## ⚠️ Bloky

### ✅ Vyřešeno
1. **FIO auto-sync** — `FIO_API_TOKEN` dostupný v `pwa-env-production`
2. **Push delivery VAPID** — VAPID klíče dostupné v `pwa-env-production`
3. **Auto-processor cron** — implementováno v `scheduler.ts` (no-show 02:00, invoice-overdue 03:00)

### Otevřené
4. **Staging deployment** — Docker Compose + staging overlay připraven, ale nenasazeno na VPS
5. **GitHub Actions smoke secrets** — pro workflow `Deploy Smoke Verify` je potřeba nastavit `SMOKE_ADMIN_EMAIL` a `SMOKE_ADMIN_PASSWORD`
6. **GitHub Actions monitor vars** — pro workflow `Public Health Monitor` je potřeba nastavit `MONITOR_BASE_URL` (volitelně i threshold vars)

## Doporučené další kroky (prioritně)
1. **Deploy na VPS / Render staging** — Docker Compose ready, DEPLOY.md průvodce, staging overlay, Certbot SSL
2. **Nastavit GitHub Actions proměnné/secrets** — `SMOKE_ADMIN_EMAIL`, `SMOKE_ADMIN_PASSWORD`, `MONITOR_BASE_URL`
3. **UX audit P2 items** — mini-kalendář v bookingu, sidebar skupiny pro RECEPTION, toast unifikace
4. **UX audit P3 items** — offline booking queue, domácí cvičení rozšíření (fotky/videa cvičení)
5. **E2E testy na nové UX features** — bottom tab bar, booking stepper, onboarding

## Projekt je feature-complete ✅
Všechna acceptance kritéria ze ZADANI.md splněna.
UX audit proveden, P1 položky implementovány.
Aplikace je připravena k nasazení.
