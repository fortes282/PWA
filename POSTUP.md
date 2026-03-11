# POSTUP — Pristav Radosti v2

Jarvis sem zapisuje každou noc co udělal, co zbývá a případné bloky.

---

## Fáze 0 — Setup (2026-03-11, noc 1)
**Status:** 🟡 Zahájeno

### Hotovo
- [x] Deploy key nastavena (jarvis-neuro-agent)
- [x] Repo inicializováno
- [x] ZADANI.md sepsáno
- [x] Noční cron nastaven (02:00 CET každý den)

### Probíhá tuto noc
- [ ] Inicializace monorepo struktury (pnpm workspaces)
- [ ] Základní Next.js 15 setup (frontend)
- [ ] Základní Fastify setup (backend)
- [ ] Shared package (@pristav/shared) se Zod schématy
- [ ] Docker Compose skeleton

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

### 2026-03-11 (noc 1 — setup)
- Inicializace repo
- ZADANI.md + POSTUP.md
- Noční cron nastaven
- Monorepo skeleton spuštěn

---

*Aktualizováno automaticky každou noc Jarvisem.*
