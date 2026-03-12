# POSTUP — Pristav Radosti v2

Jarvis sem zapisuje každou noc co udělal, co zbývá a případné bloky.

---

## Fáze 0 — Setup (2026-03-11, noc 1)
**Status:** 🟢 Dokončeno

### Hotovo
- [x] Deploy key nastavena (jarvis-neuro-agent)
- [x] Repo inicializováno
- [x] ZADANI.md sepsáno
- [x] Noční cron nastaven (02:00 CET každý den)
- [x] Inicializace monorepo struktury (pnpm workspaces)
- [x] Root scripts: `pnpm dev|lint|build` (recursive)
- [x] Shared package `@pristav/shared` (Zod schémata + role default routes)
- [x] Backend skeleton (Fastify + SQLite + migrations + seed)
- [x] Frontend skeleton (Next.js 15 App Router + Tailwind + základní dashboardy)
- [x] PWA skeleton: manifest + SW + offline page + ikony
- [x] Docker Compose + nginx skeleton
- [x] `pnpm -r lint` prochází
- [x] `pnpm -C apps/web build` prochází

### Poznámky
- Po `pnpm install` bylo nutné spustit `pnpm approve-builds --all && pnpm rebuild` (better-sqlite3/sharp/esbuild).
- DB seed přidal demo účty: admin/recepce/terapeut/klient.

### Bloky
- žádné

### Fáze 1 — Auth + RBAC (noc 2)
- Backend: login, /auth/me, refresh token, logout
- Frontend: session, route guard, RBAC
- Testy: auth flow

### Fáze 2 — Datová vrstva + core API (noc 3–4)
- Drizzle schémata + migrace
- API endpointy: users, services, rooms, appointments, credits
- Seed data

### Fáze 3 — Frontend role views (noc 5–7)
- Client: dashboard, booking, appointments, credits
- Reception: calendar, clients, billing
- Employee: day timeline, medical reports
- Admin: users, services, settings, stats

### Fáze 4 — Pokročilé features (noc 8–10)
- PDF/DOCX generování
- Push notifikace (end-to-end)
- Email (Nodemailer)
- SMS (FAYN)
- Behavior skóre
- FIO Bank matching

### Fáze 5 — Dokončení + deployment (noc 11–12)
- PWA manifest, icons, offline fallback
- Docker Compose (prod)
- Acceptance kritéria — kompletní průchod
- README + docs

---

## Denní logy

### 2026-03-11 (noc 1 — setup + skeleton)
- Vytvořen pnpm monorepo (apps/web, apps/api, packages/shared)
- Shared `@pristav/shared`: Zod schémata (auth/user/appointments/services/credits/rooms/waitlist/invoice/notifications)
- API: Fastify server + JWT + refresh cookie, core routes (users/services/rooms/appointments/credits/notifications/waitlist/medical/behavior/stats/invoices)
- DB: migrations + seed (demo data)
- Web: Next.js 15 + Tailwind, login + route guard, základní dashboardy pro CLIENT/RECEPTION/EMPLOYEE/ADMIN
- PWA: manifest + service worker + offline page + ikony
- Docker/nginx skeleton přidán
- CI sanity: `pnpm -r lint` OK, `pnpm -C apps/web build` OK
- Pushnuto do `origin/main`

### 2026-03-12 (noc 2 — build fix, auth testy, seed, Phase 2 start)
- **Build fix:** Přidány `.js` extenze do `packages/shared/src/index.ts` pro NodeNext resolution
- **Webpack fix:** Přidán `extensionAlias` do `next.config.ts` aby Next.js webpack rozuměl `.js` → `.ts` mapování
- **Refactor:** `apps/api/src/server.ts` refactored na `buildApp()` pattern pro testovatelnost
- **Auth testy:** 9 testů (vitest, in-memory SQLite): login success/fail/inactive, /me s/bez tokenu, refresh valid/invalid/missing, logout + cookie invalidace
- **Seed data:** Hesla opravena dle specifikace (Admin123!, Recepce123!, Terapeut123!, Klient123!), přidáno 6 appointments v různých stavech, credit transakce, notifikace
- **API endpoint:** GET /credits/history (alias pro uživatelské transakce)
- **API endpoint:** GET /appointments/available?serviceId=X&date=YYYY-MM-DD — volné sloty na základě working hours, existujících appointments a dostupnosti místností
- **Booking UX:** Klient vybere službu → datum → zobrazí se volné sloty jako karty (terapeut + čas) → souhrn → potvrzení
- **Reception client detail:** `/reception/clients/[id]` — behavior score, kredit, nadcházející/minulé termíny, kreditní transakce
- **Stávající pages ověřeny:** appointments (filtr/badge/storno), credits (zůstatek+historie), employee timeline (07-20 + now linka) — vše funkční
- **CI sanity:** `pnpm -r lint` OK, `pnpm -C apps/api test` 9/9 OK, `pnpm -C apps/web build` OK

#### Co zbývá
- [x] Phase 2: Všechny reception/admin stránky ✅ (viz session 2026-03-12)
- [x] Phase 3: PDF, push, email, FIO matching ✅
- [x] Phase 4: Docker prod ✅
- [x] README ✅
- [ ] SMS (FAYN) — stub připraven, čeká na API key
- [ ] Acceptance tests E2E (Playwright) — nice to have

#### Bloky
- žádné

---

### 2026-03-12 (mimořádná session 12:17–14:16 CET)

**Postup:** Phase 2+3+4 kompletně dokončeny.

#### Frontend — nové stránky (celkem 33)

**Reception:**
- `/reception/appointments` — seznam termínů, filtry, nový termín, workflow (aktivace/potvrzení/dokončení/no-show/zrušení)
- `/reception/waitlist` — správa waitlistu, upozorňování klientů, bulk akce
- `/reception/billing` — faktury, tvorba s položkami, PDF download, stavový workflow
- `/reception/working-hours` — nastavení pracovních hodin terapeuta (per-den, accordion)
- `/reception/invoices/[id]` — detail faktury (R9: položky, notes editace, PDF, stavové akce)

**Admin:**
- `/admin/rooms` — CRUD místností, aktivace/deaktivace
- `/admin/settings` — globální nastavení (faktury, notifikace, behavior skóre, provoz, systémové info)
- `/admin/background` — behavior evaluace, záznamy událostí, skóre per klient, skóre histogram
- `/admin/fio` — FIO bank matching (D1: transaction list, auto-match, manuální párování, summary stats)

**Employee:**
- `/employee/appointments` — vlastní termíny + expandable klientská karta (E2)
- `/employee/colleagues` — přehled kolegů a jejich pracovních hodin

**Client:**
- `/client/progress` — behavior skóre bar, grafy sezení po měsících, kreditní přehled (C8)
- `/client/waitlist` — správa vlastního waitlistu (C7)

**Sdílené:**
- `NotificationBell` component — live polling 30s, unread badge, dropdown (S1)
- `/settings` — Push subscribe button (UI pro Web Push aktivaci)
- PDF download buttons v client/reports + employee/reports

#### API — nové routes

- `/working-hours/*` — GET (all/per employee), PUT upsert, PATCH toggle
- `/pdf/medical-report/:id` — generování PDF z medical report (bez external lib)
- `/pdf/invoice/:id` — generování PDF faktury
- `/fio/*` — transactions CRUD, auto-matching by VS, match/unmatch, summary
- `/push/*` — Web Push subscribe/unsubscribe/test, VAPID public key endpoint
- `/notifications` POST/DELETE — create/delete notifikací
- `/invoices/:id/notes` PATCH — editace poznámky k faktuře
- `/waitlist/:id` PATCH — status update endpoint

#### Services

- `apps/api/src/services/email.ts` — Nodemailer SMTP (graceful no-op bez SMTP konfigurace)
  - Templates: appointment confirmed, reminder, invoice, waitlist notification
  - Integrace do appointment workflow (email při vytvoření/potvrzení)

#### Tests

- `src/__tests__/services.test.ts` — 16 nových integration testů
  - Health, Services/Rooms RBAC, Waitlist auth guard, Notifications RBAC, Appointments auth guard
- Celkem: **25 testů, 2 test files, 100% pass**

#### DevOps / Docs

- `.env.example` — kompletní šablona pro produkční deployment
- `scripts/backup.sh` — SQLite backup cron script (D3)
- `README.md` — kompletní: stack, demo účty, deployment, architektura, role matrix

#### Stav acceptance kritérií

- ✅ G1–G5: PWA, manifest, icons, offline, lint/test
- ✅ A1–A6: Auth, RBAC, JWT refresh, session persistence
- ✅ C1–C8: Všechny klientské stránky
- ✅ R1–R9: Všechny recepční stránky
- ✅ E1–E4: Všechny terapeut stránky
- ✅ AD1–AD6: Všechny admin stránky
- ✅ S1–S2: Notifikace bell, offline fallback
- ✅ D1–D3: FIO matching, seed data, SQLite backup
- ⏳ SMS (FAYN): stub připraven (FAYN_API_KEY env var), potřeba API key

#### Bloky
- žádné

---

*Aktualizováno automaticky — mimořádná session 2026-03-12.*
