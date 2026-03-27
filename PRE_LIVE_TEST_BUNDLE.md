# Pre-live test bundle (jeden runbook)

**Zdroj ID scénářů:** detailní tabulky a tagy zůstávají v [PWA_TEST_MATRIX.md](PWA_TEST_MATRIX.md). Tento soubor je **operativní balík**: pořadí, příkazy, bezpečnost, DAST, sign-off — bez nutnosti procházet více dokumentů.

---

## Fáze 0 — Předpoklady a cílová URL

- Testuj stejnou verzi a prostředí jako kandidát na produkci (ideálně staging na stejném stacku).
- **API pro E2E na serveru:** v `.env` ověř `CI=true`, dostatečně vysoký `AUTH_LOGIN_RATE_LIMIT_MAX`, `JWT_EXPIRES_IN` (např. `2h`); po změně restart API (`docker compose … api`).
- **Z vývojářského stroje (Playwright):** `BASE_URL`, `NEXT_PUBLIC_API_URL` (typicky `<BASE_URL>/api`), volitelně `E2E_LOGIN_GAP_MS=500` pokud limit na API dovolí.

---

## Fáze 1 — Lokální CI ekvivalent (blokace při failu)

Automaticky (z kořene monorepa):

```bash
./scripts/pre-live-verify.sh
```

Nebo ručně totéž co skript dělá při plném běhu:

```bash
pnpm install --frozen-lockfile
pnpm -C packages/shared build
pnpm -r lint
pnpm -r test
NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://127.0.0.1:3001}" pnpm -r build
```

**Rychlá varianta** (přeskočí lint/test/build, zůstane audit + health + security matrix):

```bash
SKIP_LOCAL=1 ./scripts/pre-live-verify.sh
```

Logy skriptu: adresář `.pre-live-reports/` (gitignored).

---

## Fáze 2 — Vitest API (plná suite + bezpečnostní podmnožina)

Plná suite:

```bash
pnpm -C apps/api test
```

**Go-live:** ne spoléhat jen na „celý test zelený“. Spusť explicitní mapu SEC / RBAC / AUTH:

```bash
pnpm -C apps/api test:security-matrix
```

### Mapování bezpečnostních ID → Vitest soubory

| Matrix ID | Primární soubor(y) | Co ověřit |
|-----------|-------------------|-----------|
| SEC-01 | `apps/api/src/__tests__/sanitize.test.ts` | Escapování XSS (`escapeHtml` / `sanitizeText`) |
| SEC-02 | `apps/api/src/__tests__/security-matrix.test.ts` | Neplatný / podvržený JWT → 401 |
| SEC-03 | `apps/api/src/__tests__/account-lockout.test.ts` | Lockout po neúspěšných pokusech (429) |
| SEC-04 | `apps/api/src/__tests__/security-matrix.test.ts` | V `NODE_ENV=production` 5xx bez úniku vnitřní zprávy v JSON |
| RBAC-02 | `apps/api/src/__tests__/behavior.test.ts` (+ další doménové suite s 403) | Klient nedostane staff/admin endpointy |
| RBAC-03 | `apps/api/src/__tests__/health-records.test.ts` | IDOR: cizí záznam → 403 |
| AUTH-03 | `apps/api/src/__tests__/auth.test.ts` | Neplatný refresh; po `logout` starý refresh neobnoví session |
| AUTH-RESET-01–03 | `apps/api/src/__tests__/password-reset.test.ts` | Forgot → reset happy path, token expiry, anti-enumeration (20 testů) |
| 2FA-01 | ⚠️ **CHYBÍ** — napsat `totp.test.ts` | TOTP setup + QR + verify → backup kódy vygenerovány |
| 2FA-02 | ⚠️ **CHYBÍ** — napsat `totp.test.ts` | Login s pendingToken → plný JWT až po TOTP verify |
| 2FA-03 | ⚠️ **CHYBÍ** — napsat `totp.test.ts` | Backup code jednorázový, po použití invalidován |
| 2FA-05 | ⚠️ **CHYBÍ** — napsat `totp.test.ts` | Rate limit: verify 10/min, backup 5/15min |
| GDPR-01 | ⚠️ **CHYBÍ** — napsat `gdpr.test.ts` | Consent grant/revoke s audit trail |
| GDPR-02 | ⚠️ **CHYBÍ** — napsat `gdpr.test.ts` | Client erasure request → stav pending, admin notifikace |
| GDPR-03 | ⚠️ **CHYBÍ** — napsat `gdpr.test.ts` | Admin erasure → anonymizace, health records smazány, 2FA vyčištěno |
| GDPR-04 | ⚠️ **CHYBÍ** — napsat `gdpr.test.ts` | Access log: přístup k health record = záznam (kdo, kdy, čí data) |

Další Vitest ID z matice §5 (AUTH-02, AUTH-04, NT-*, PERF-02, …) jsou v plné suite výše — viz [PWA_TEST_MATRIX.md](PWA_TEST_MATRIX.md) §5.

### Chybějící testové soubory (TODO před go-live)

Následující soubory je třeba **vytvořit**, aby security matrix pokrývala nové sekce matice:

| Soubor | Pokrývá | Priorita |
|--------|---------|----------|
| `apps/api/src/__tests__/totp.test.ts` | 2FA-01 až 2FA-06 | **P0** — ADMIN/EMPLOYEE mají mandatory 2FA |
| `apps/api/src/__tests__/gdpr.test.ts` | GDPR-01 až GDPR-05 | **P0** — aplikace zpracovává zdravotní data (GDPR čl. 9) |

Po vytvoření přidat do `package.json` skriptu `test:security-matrix`:
```bash
vitest run src/__tests__/{sanitize,security-matrix,account-lockout,auth,behavior,health-records,password-reset,totp,gdpr}.test.ts
```

---

## Fáze 2b — Závislosti a produkční konfigurace

### `pnpm audit`

```bash
pnpm install
pnpm audit
pnpm audit --production
```

**Záznam z repa (aktualizuj po změně závislostí):**

- **Override:** `flatted@3.4.2` v kořenovém `package.json` (`pnpm.overrides`) — řeší dřívější high (prototype pollution) v dev řetězci eslint.
- **Zbývající high — picomatch** přes `eslint-config-next` / TypeScript ESLint: **dev / lint**, ne produkční runtime; ReDoS relevantní hlavně při nepředvídatelných glob vzorech od útočníka — typický CI lint to neexponuje. Sledovat upgrade `eslint-config-next`.
- **Moderate — esbuild** (Vitest, drizzle-kit): CVE se týká **dev serveru** esbuild (`serve`), ne produkčního buildu na VPS.

High/critical v produkčním stromu řešit záplatou nebo zdůvodnit v release poznámkách.

### TLS, cookies, CORS, `NEXT_PUBLIC_*`

| Oblast | Kde v repu | Poznámka |
|--------|------------|----------|
| TLS / proxy | `nginx/nginx.conf`, `nginx/nginx-staging.conf` | HTTPS redirect, hlavičky; na VPS ověřit cert a SSL server bloky. |
| Refresh cookie | `apps/api/src/routes/auth.ts` | `httpOnly: true`, `sameSite: "strict"`, `secure` pokud `COOKIE_SECURE=true`. |
| CORS | `apps/api/src/server.ts` (`ALLOWED_ORIGINS`) | Jen očekávané originy. |
| Klientské env | `NEXT_PUBLIC_*` v `apps/web` | Jen veřejné hodnoty (URL API); žádné secrets. |

---

## Fáze 3 — Deploy kandidát a dostupnost

- Nasazení dle [AGENTS.md](AGENTS.md) nebo GitHub *Deploy to VPS*.
- Ověřit `GET /api/health` (200, `status: ok`), veřejný `/login` (200).

Health check volitelně přes skript:

```bash
HEALTH_URL=https://váš-host/api/health ./scripts/pre-live-verify.sh
# nebo jen curl
```

---

## Fáze 3b — DAST a penetrační minimum

### OWASP ZAP Baseline (doporučeno před větším go-live)

Vyžaduje Docker, cíl = **HTTPS** staging/test URL:

```bash
./scripts/security/zap-baseline.sh https://váš-staging-host
```

Výstup: `zap-reports/zap-baseline-<UTC>.html` a `.json` (složka gitignored).

**Kritérium:** high nálezy vyřešit nebo formálně akceptovat; false positives zdokumentovat.

### Manuální minimum (grey box)

- Bez tokenu: náhodné `GET /api/...` chráněné endpointy → **401/403**, ne 200 s daty.
- IDOR vzorek: token klienta + cizí ID (soulad s RBAC-03).
- XSS: reflektované/uložené vstupy v UI (soulad SEC-01 + matice §3).
- Session: odhlášení invaliduje přístup; refresh scénář (AUTH-03).

### Externí pentest (doporučeno u zdravotních dat)

- **Frekvence:** min. **1× ročně** nebo po velké architektonické změně.
- **Rozsah:** staging; web + API; **bez DoS**; test účty dle dohody.
- **P1+:** retest u dodavatele před uzavřením.
- Výstupy uložit mimo git (interní úložiště) + zaznamenat datum a commit.

---

## Fáze 4 — Playwright E2E (deploy-first)

Aplikace musí být **už nasazená**. Prerekvizity na VPS (`.env`): viz [PWA_TEST_MATRIX.md](PWA_TEST_MATRIX.md) §8 (`CI`, `JWT_EXPIRES_IN`, `AUTH_LOGIN_RATE_LIMIT_MAX`, restart API).

1. Auth setup (blokace, pokud failne):

```bash
BASE_URL=http://109.123.243.52 \
NEXT_PUBLIC_API_URL=http://109.123.243.52/api \
E2E_LOGIN_GAP_MS=500 \
pnpm -C apps/web exec playwright test e2e/auth.setup.ts --project=setup
```

2. Full suite:

```bash
BASE_URL=http://109.123.243.52 \
NEXT_PUBLIC_API_URL=http://109.123.243.52/api \
E2E_LOGIN_GAP_MS=500 \
pnpm -C apps/web exec playwright test
```

3. **P0 iOS layout:** `e2e/iphone-layout-smoke.spec.ts` — projekt `iphone` (povinné před go-live dle matice §6).

4. **Android (doporučeno):** projekty `android` + `android-samsung` — `e2e/android-layout-smoke.spec.ts`, `e2e/android-login-pwa.spec.ts` (viz matice **K2** a §8).

5. **iPad / tablet (doporučeno):** projekt `ipad` — `e2e/tablet-layout-smoke.spec.ts` (matice **K3**; sdílené responzivní pravidla `dialog-surface` / `dialog-text` v CSS, ne oddělené breakpointy pro každou velikost).

6. Doporučeno před větší UI změnou: `e2e/iphone-visual-audit.spec.ts` — projekt `iphone`.

Detail příkazů a omezení: [PWA_TEST_MATRIX.md](PWA_TEST_MATRIX.md) §8.

---

## Fáze 5 — Go-live gate (manuální + konzistence s automatizací)

Projít [PWA_TEST_MATRIX.md](PWA_TEST_MATRIX.md) §6 bod po bodu: PWA, auth, RBAC, booking, notifikace, billing/export, security sanity (**SEC-01**, **SEC-02** už ve Vitestu ve fázi 2), iOS vizuál (`IOS-VIS-01`, `IOS-VIS-03` dle matice), Android **K2**, iPad **K3** (Playwright).

---

## Fáze 6 — Sign-off

- Fáze 1–2 (+2b) zelené; nasazený kandidát (fáze 3); fáze 3b dle politiky (ZAP nebo záznam odložení); fáze 4 zelená; fáze 5 bez otevřených P0.
- **2FA:** `2FA-01`, `2FA-02`, `2FA-03` zelené (pendingToken flow, TOTP setup, backup kódy). ADMIN/EMPLOYEE nesmí obejít 2FA.
- **GDPR:** `GDPR-01`, `GDPR-02`, `GDPR-03` zelené (consent, erasure request, anonymizace). Aplikace zpracovává zdravotní data — GDPR čl. 9.
- **Password reset:** `AUTH-RESET-01` zelený (forgot → reset → login s novým heslem).
- Zapsat verzi/commit, čas testu, odkaz na ZAP/pentest report (pokud existuje).
- Produkční deploy = stejný artefakt jako ověřený.
- Po cut: znovu health + krátký smoke (login jednou rolí) nebo *Deploy Smoke Verify*.

---

## Automatizační skript (shrnutí)

| Příkaz | Účel |
|--------|------|
| `pnpm prelive:verify` | Totéž co `./scripts/pre-live-verify.sh` |
| `./scripts/pre-live-verify.sh` | CI ekvivalent + `pnpm -C apps/api test` (log) + audit + health + `test:security-matrix` |
| `SKIP_LOCAL=1 ./scripts/pre-live-verify.sh` | Audit + health + security matrix |
| `./scripts/security/zap-baseline.sh <URL>` | ZAP Baseline (Docker) |

---

## Artefakty při selhání

- `apps/web/test-results/**` (screenshot, video, trace).
- Log z API kontejneru pro čas selhání.
- Přesný commit a `BASE_URL`.
- U ZAP: příslušné HTML/JSON v `zap-reports/`.
