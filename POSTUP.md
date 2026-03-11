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

---

*Aktualizováno automaticky každou noc Jarvisem.*
