# Changelog

Všechny změny v projektu Přístav Radosti v2.

## [2.1.0] — 2026-03-18

### Changed
- Verze API zvýšena na 2.1.0
- Lint cleanup: 0 warningů (ESLint + TypeScript)
- Avatar obrázky používají `next/image` s `unoptimized` (dynamické API URL)
- `useEffect` dependencies opraveny v admin/background audit log

### Previous (2.0.0)

#### NOC 20 — Production Hardening & Deployment
- Graceful shutdown (SIGTERM/SIGINT) pro Docker
- Global error handler: strukturované JSON chybové odpovědi
- Request tracing: `x-request-id` header propagace
- Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- Docker Compose staging overlay (HTTP-only)
- DEPLOY.md — kompletní deployment průvodce
- Swagger API dokumentace na `/docs`

#### NOC 19 — Service Packages, Public Booking, E2E testy
- Service packages CRUD + purchase flow
- Public online booking (bez auth)
- E2E testy pro NOC 18 + 19 features

#### NOC 18 — Recurring Appointments, CSV Export, Reports
- Recurring appointments (WEEKLY/BIWEEKLY/MONTHLY)
- CSV export (klienti, termíny, faktury)
- Monthly revenue + weekly occupancy reports
- Frontend: export záložka, reporty s grafy

#### NOC 17 — Auto-Processor Cron, Notification Prefs, Audit Log UI
- node-schedule: no-show (02:00), invoice-overdue (03:00)
- Notification preferences API + UI
- Admin audit log záložka

#### NOC 16 — Messages, Ratings, Staff Notes, Timeline, Recommendations, iCal
- Direct messages (inbox, sent, replies, contacts)
- Appointment ratings (1-5 hvězd, leaderboard)
- Staff client notes (veřejné + privátní)
- Client timeline (chronologická osa událostí)
- Auto-processor (no-shows, invoice overdue)
- Smart recommendations (rebooking, at-risk, loyalty rewards)
- iCal export (RFC 5545)
- Employee clients + stats

#### NOC 15 — Reminders, Waitlist, Loyalty, Templates, Health Goals
- SMS + email reminders
- Waitlist auto-fill s notifikacemi
- Loyalty points system (balance, leaderboard)
- Appointment templates
- Client health goals
- Admin system health monitor rozšíření

#### NOC 8–14
- Viz git history pro detailní changelog starších nocí
