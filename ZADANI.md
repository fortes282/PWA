# ZADÁNÍ — Pristav Radosti v2

**Autor zadání:** marc simon  
**Řeší:** Jarvis (autonomní agent)  
**Repo:** https://github.com/fortes282/PWA  
**Zahájení:** 2026-03-11  
**Pracovní okno:** každý den 02:00–05:00 (noční cron)

---

## Kontext

Přestavba aplikace [fortes282/PR](https://github.com/fortes282/PR) od nuly.  
Cíl: kompletní, produkčně nasaditelná PWA pro neurorehabilitační centrum "Pristav Radosti".  
Žádná AI vrstva navíc — jen dokonalá verze samotné aplikace.

## Reference

- Původní repo: https://github.com/fortes282/PR
- Dokumentace originálu: docs/About.md v PR repo (zkopírována do docs/original-about.md)

---

## Hlavní cíle

### Byznys
1. **Maximální obsazenost slotů** — waitlist, predikce no-show, automatické přeplánování
2. **Klient lock-in** — pokrok, kredity, zprávy, historie = nechce odejít
3. **Nulová administrativa** — připomínky, faktury, zprávy jedou automaticky

### Technické
4. **Vše funkční v produkci** — PDF, behavior skóre, health records, profile log (ne jen v mock)
5. **Reálné notifikace** — push, email, SMS (FAYN)
6. **Produkce bez bolesti** — Docker Compose, JWT refresh, SQLite backup
7. **Bezpečnost** — RBAC na backendu, bez `origin: true`, bez fallback secrets

### UX
8. **Klientský portál** — pokrok, zprávy od terapeuta, kreditový systém
9. **Recepce = řídící centrum** — calendar + waitlist + billing na jednom místě
10. **Admin dashboard** — obsazenost, výnosy, predikce

---

## Stack

| Vrstva | Technologie |
|--------|-------------|
| Frontend | Next.js 15 (App Router), TypeScript strict, Tailwind CSS |
| Backend | Fastify, SQLite (better-sqlite3), Drizzle ORM |
| Auth | JWT + refresh token, httpOnly cookies |
| PDF | pdf-lib nebo Puppeteer |
| Email | Nodemailer (SMTP) |
| SMS | FAYN API |
| Push | Web Push (VAPID) |
| Deploy | Docker Compose |
| Testy | Vitest (unit), Playwright (e2e) |

---

## Role v aplikaci

- **CLIENT** — dashboard, booking, rezervace, kredity, zprávy, nastavení, waitlist
- **RECEPTION** — calendar, working hours, booking activation, appointments, klienti, waitlist, billing
- **EMPLOYEE** — calendar (day timeline), rezervace, zdravotní záznamy, lékařské zprávy, kolegové
- **ADMIN** — uživatelé, služby, místnosti, nastavení, billing, statistiky, background

---

## Kompletní feature list (co musí fungovat v produkci)

### Původně jen v mock — musí fungovat i v HTTP:
- [ ] Lékařské zprávy (medical reports) — vytvoření, uložení, PDF/DOCX export
- [ ] Behavior skóre — výpočet z událostí, zobrazení v seznamu klientů
- [ ] Client profile log — history změn profilu
- [ ] FIO Bank matching — párování plateb

### Nové / vylepšené:
- [ ] JWT refresh token flow (frontend + backend)
- [ ] Real push notifikace (end-to-end test)
- [ ] Real email (Nodemailer)
- [ ] Real SMS (FAYN)
- [ ] PDF generování (lékařské zprávy, faktury)
- [ ] DOCX generování (lékařské zprávy)
- [ ] Obsazenost slotů — vizualizace a analytika
- [ ] Automatické waitlist notifikace
- [ ] Predikce no-show (behavior skóre)
- [ ] Klientský pokrok dashboard
- [ ] Admin stats — výnosy, obsazenost, predikce
- [ ] Docker Compose (frontend + backend + nginx)
- [ ] SQLite backup cron

---

## Acceptance kritéria (musí projít před "hotovo")

### Obecné / PWA
- [ ] G1: `pnpm install && pnpm dev` spustí app bez chyb
- [ ] G2: Web manifest s name, theme_color, icons
- [ ] G3: Ikony public/icons/icon-192.png + icon-512.png
- [ ] G4: Offline fallback /offline
- [ ] G5: `pnpm lint` a `pnpm test` projdou

### Auth / RBAC
- [ ] A1: Login email/password
- [ ] A2: Role-based default routes
- [ ] A3: Route protection (přesměrování)
- [ ] A4: Session persistence
- [ ] A5: Logout
- [ ] A6: JWT refresh (nové — automatické obnovení tokenu)

### Klient
- [ ] C1: Dashboard (příští termín, kredit, odkaz na booking)
- [ ] C2: Booking (aktivace, denní vizuál, confirmation modal)
- [ ] C3: Moje rezervace (status, platba, storno)
- [ ] C4: Kredity (zůstatek, transakce)
- [ ] C5: Zprávy (terapeutické dokumenty)
- [ ] C6: Nastavení (email/SMS/push toggles)
- [ ] C7: Waitlist
- [ ] C8: Pokrok dashboard (nové)

### Recepce
- [ ] R1: Kalendář (týden, měsíc, filtr terapeuta)
- [ ] R2: Pracovní hodiny
- [ ] R3: Booking activation
- [ ] R4: Termíny (seznam, nový, blok, detail)
- [ ] R5: Klienti (vyhledávání, bulk email/SMS, detail)
- [ ] R6: Health record
- [ ] R7: Waitlist (záznamy, návrhy)
- [ ] R8: Billing (report, faktura, odeslání, upomínky)
- [ ] R9: Faktury (detail, editace)

### Terapeut
- [ ] E1: Day timeline calendar (07:00–20:00, "Teď" linka)
- [ ] E2: Termíny + detail (klientská karta)
- [ ] E3: Lékařské zprávy (vytvoření, PDF/DOCX download)
- [ ] E4: Kolegové

### Admin
- [ ] AD1: Uživatelé + role
- [ ] AD2: Služby (CRUD)
- [ ] AD3: Místnosti (CRUD)
- [ ] AD4: Nastavení (faktury, notifikace, SMS, push)
- [ ] AD5: Statistiky (obsazenost, storna, client tags)
- [ ] AD6: Background (behavior evaluace, doporučení)

### Sdílené
- [ ] S1: In-app notifikace (seznam, označit přečtené)
- [ ] S2: Offline fallback

### Data
- [ ] D1: HTTP režim — vše funkční (žádné 404 v produkci)
- [ ] D2: Seed data při prvním startu
- [ ] D3: SQLite backup

---

## Poznámky k nasazení

- Docker Compose: frontend (3000) + backend (3001) + nginx (80/443)
- Env proměnné přes .env.production (ne commitovat)
- SQLite: absolutní cesta přes DATABASE_PATH, pravidelný backup
- CORS: whitelist konkrétní origin, ne `origin: true`
- JWT_SECRET: vždy generovat, nikdy fallback

---

*Tento soubor je živý dokument. Jarvis ho aktualizuje každou noc podle postupu.*
