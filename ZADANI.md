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
- [x] Lékařské zprávy (medical reports) — vytvoření, uložení, PDF/DOCX export
- [x] Behavior skóre — výpočet z událostí, zobrazení v seznamu klientů
- [x] Client profile log — history změn profilu
- [x] FIO Bank matching — párování plateb

### Nové / vylepšené:
- [x] JWT refresh token flow (frontend + backend)
- [ ] Real push notifikace (end-to-end test)
- [ ] Real email (Nodemailer)
- [ ] Real SMS (FAYN)
- [x] PDF generování (lékařské zprávy, faktury)
- [x] DOCX generování (lékařské zprávy)
- [x] Obsazenost slotů — vizualizace a analytika
- [x] Automatické waitlist notifikace
- [x] Predikce no-show (behavior skóre)
- [x] Klientský pokrok dashboard
- [x] Admin stats — výnosy, obsazenost, predikce
- [x] Docker Compose (frontend + backend + nginx)
- [x] SQLite backup cron

---

## Acceptance kritéria (musí projít před "hotovo")

### Obecné / PWA
- [x] G1: `pnpm install && pnpm dev` spustí app bez chyb
- [x] G2: Web manifest s name, theme_color, icons
- [x] G3: Ikony public/icons/icon-192.png + icon-512.png
- [x] G4: Offline fallback /offline
- [x] G5: `pnpm lint` a `pnpm test` projdou

### Auth / RBAC
- [x] A1: Login email/password
- [x] A2: Role-based default routes
- [x] A3: Route protection (přesměrování)
- [x] A4: Session persistence
- [x] A5: Logout
- [x] A6: JWT refresh (nové — automatické obnovení tokenu)

### Klient
- [x] C1: Dashboard (příští termín, kredit, odkaz na booking)
- [x] C2: Booking (aktivace, denní vizuál, confirmation modal)
- [x] C3: Moje rezervace (status, platba, storno)
- [x] C4: Kredity (zůstatek, transakce)
- [x] C5: Zprávy (terapeutické dokumenty)
- [x] C6: Nastavení (email/SMS/push toggles)
- [x] C7: Waitlist
- [x] C8: Pokrok dashboard (nové)

### Recepce
- [x] R1: Kalendář (týden, měsíc, filtr terapeuta)
- [x] R2: Pracovní hodiny
- [x] R3: Booking activation
- [x] R4: Termíny (seznam, nový, blok, detail)
- [x] R5: Klienti (vyhledávání, bulk email/SMS, detail)
- [x] R6: Health record
- [x] R7: Waitlist (záznamy, návrhy)
- [x] R8: Billing (report, faktura, odeslání, upomínky)
- [x] R9: Faktury (detail, editace)

### Terapeut
- [x] E1: Day timeline calendar (07:00–20:00, "Teď" linka)
- [x] E2: Termíny + detail (klientská karta)
- [x] E3: Lékařské zprávy (vytvoření, PDF/DOCX download)
- [x] E4: Kolegové

### Admin
- [x] AD1: Uživatelé + role
- [x] AD2: Služby (CRUD)
- [x] AD3: Místnosti (CRUD)
- [x] AD4: Nastavení (faktury, notifikace, SMS, push)
- [x] AD5: Statistiky (obsazenost, storna, client tags)
- [x] AD6: Background (behavior evaluace, doporučení)

### Sdílené
- [x] S1: In-app notifikace (seznam, označit přečtené)
- [x] S2: Offline fallback

### Data
- [x] D1: HTTP režim — vše funkční (žádné 404 v produkci)
- [x] D2: Seed data při prvním startu
- [x] D3: SQLite backup

---

## Poznámky k nasazení

- Docker Compose: frontend (3000) + backend (3001) + nginx (80/443)
- Env proměnné přes .env.production (ne commitovat)
- SQLite: absolutní cesta přes DATABASE_PATH, pravidelný backup
- CORS: whitelist konkrétní origin, ne `origin: true`
- JWT_SECRET: vždy generovat, nikdy fallback

---

*Tento soubor je živý dokument. Jarvis ho aktualizuje každou noc podle postupu.*
