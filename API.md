# API Reference

Fastify 4 REST API bezici na portu 3001. Swagger UI dostupny na `/docs`.

## Autentizace

### JWT flow

1. `POST /auth/login` s `{email, password}` → vrati `{accessToken, user}`
2. Server nastavi cookies `accessToken` (httpOnly, secure, sameSite:strict) a `refreshToken`
3. Klient posila `Authorization: Bearer <token>` + cookies na kazdy request
4. Access token vyprsi za 15 min → klient zavola `POST /auth/refresh`
5. Refresh token rotace: stary se smaze, vytvori se novy (30 dni expirace)

### 2FA (TOTP)

1. `POST /auth/2fa/setup` → vrati `{secret, qrCode}`
2. Uzivatel naskenuje QR a zada 6-mistny kod
3. `POST /auth/2fa/verify` s `{pendingToken, code}`
4. Pokud je 2FA zapnute, login vrati `{requires2FA: true, pendingToken}` (5 min platnost)
5. 8 zaloznich kodu (SHA-256 hash, single-use)

### API klice

- Header: `X-API-Key: <klic>`
- Prefix `pr_live_` + 32 hex bajtu
- Ulozene jako SHA-256 hash v DB
- Scoped opravneni (JSON pole, napr. `["admin:api-keys:read", "admin:backup:write"]`)
- Podpora wildcard `"*"`
- Expirace + `last_used_at` tracking

### Logout

- `POST /auth/logout` — smaze refresh token, vymaze cookies
- `POST /auth/logout-all` — smaze VSECHNY refresh tokeny uzivatele (vsechna zarizeni)

## Rate limiting

| Endpoint | Limit | Okno |
|----------|-------|------|
| Globalni | 100 req | 1 min per IP |
| `POST /auth/login` | 5 pokusu | 15 min per IP |
| Public booking | 8 req | 10 min per IP |
| Po 5 neuspesnych loginech | Lockout | 15 min |

V CI prostredi (`CI=true`) jsou limity vypnute.

## Format chyb

```json
{
  "error": "Error",
  "message": "Popis chyby",
  "statusCode": 400
}
```

| Kod | Vyznam |
|-----|--------|
| 400 | Validacni chyba (Zod safeParse) |
| 401 | Neplatny/chybejici token |
| 403 | Nedostatecna role nebo scope |
| 404 | Zdroj nenalezen |
| 409 | Konflikt (duplicitni email, casovy konflikt terminu) |
| 429 | Rate limit prekrocen (vcetne `retryAfter` u loginu) |
| 500 | Interni chyba (v produkci skryty detaily) |

## RBAC — pristup k routam

Kazdy route pouziva `requireRole()` middleware, ktery kontroluje roli z JWT:

| Role | Hodnota |
|------|---------|
| `CLIENT` | Vlastni data, booking, kredity, zpravy, pokrok |
| `RECEPTION` | Sprava terminu, klientu, billing, waitlist |
| `EMPLOYEE` | Vlastni kalendar, klienti, lekarske zpravy |
| `ADMIN` | Plny pristup ke vsemu |

## Endpointy podle kategorii

### Zdravi a monitoring

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/health` | Docker healthcheck (200 OK) |
| GET | `/health/ping` | Jednoduchy ping |
| GET | `/health/detailed` | DB ping, feature flags, uptime |

### Autentizace

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| POST | `/auth/login` | Prihlaseni |
| POST | `/auth/refresh` | Obnoveni access tokenu |
| POST | `/auth/logout` | Odhlaseni |
| POST | `/auth/logout-all` | Odhlaseni ze vsech zarizeni |
| GET | `/auth/me` | Aktualni uzivatel |
| POST | `/auth/2fa/setup` | Nastaveni 2FA |
| POST | `/auth/2fa/verify` | Overeni 2FA kodu |

### Uzivatele

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/users` | Seznam uzivatelu (ADMIN/RECEPTION) |
| GET | `/users/me` | Profil aktualniho uzivatele |
| GET | `/users/:id` | Detail uzivatele |
| POST | `/users` | Vytvoreni uzivatele (ADMIN) |
| PATCH | `/users/:id` | Uprava uzivatele |
| POST | `/users/:id/reactivate` | Obnoveni deaktivovaneho (ADMIN) |
| GET | `/users/export/csv` | Export CSV (ADMIN/RECEPTION) |

### Terminy

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/appointments` | Seznam s filtraci (status, search, page, limit) |
| GET | `/appointments/:id` | Detail (enriched: clientName, employeeName, serviceName) |
| POST | `/appointments` | Vytvoreni (vcetne conflict check klient + terapeut → 409) |
| PATCH | `/appointments/:id` | Uprava |
| PATCH | `/appointments/:id/notes` | Editace poznamek (bez zmeny statusu) |
| DELETE | `/appointments/:id` | Zruseni |

### Booking

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| POST | `/booking-v2` | Nove booking flow |
| POST | `/booking-public` | Verejna rezervace (bez prihlaseni, rate limited) |

### Sluzby a mistnosti

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/services` | Sluzby (?includeInactive=true pro ADMIN) |
| POST/PATCH/DELETE | `/services/:id` | CRUD (ADMIN) |
| GET | `/rooms` | Mistnosti |
| POST/PATCH/DELETE | `/rooms/:id` | CRUD (ADMIN) |

### Finance

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/credits/history` | Kreditni historie (page, limit) |
| POST | `/credit-requests` | Zadost o kredity |
| GET | `/invoices` | Faktury |
| POST | `/invoices` | Vytvoreni faktury |
| GET | `/fio/export/csv` | Export FIO transakcí (CSV) |

### Zdravotni zaznamy

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/health-records/:clientId` | Zdravotni karta (sifrovana AES-256-GCM) |
| PATCH | `/health-records/:clientId` | Uprava |
| GET | `/medical/:clientId` | Lekarske zpravy |
| POST | `/medical` | Nova zprava |

### Notifikace

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/notifications` | Notifikace uzivatele |
| PATCH | `/notifications/:id/read` | Oznacit jako prectene |
| DELETE | `/notifications/clear-read` | Smazat prectene |
| GET | `/notification-preferences` | Preference |
| PATCH | `/notification-preferences` | Uprava preferenci |

### Push notifikace

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| POST | `/push/subscribe` | Registrace push subscription |
| POST | `/push/unsubscribe` | Odregistrace |

### Dashboard

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/dashboard/reception` | Agregovana data pro recepci (1 volani) |
| GET | `/dashboard/client` | Klientsky souhrn (balance, nextAppt, stats) |

### Statistiky a analytika

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/stats` | Statistiky + revenueByMonth (12 mesicu) |
| GET | `/analytics` | Analyticka data |
| GET | `/heatmap` | Heatmapa vyuziti |

### Waitlist

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/waitlist` | Cekaci listina |
| POST | `/waitlist` | Pridani na waitlist |
| PATCH | `/waitlist/:id` | Uprava statusu |

### Pracovni hodiny a nepritomnost

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/working-hours/:employeeId` | Pracovni hodiny |
| PUT | `/working-hours/:employeeId` | Nastaveni |
| GET/POST | `/time-off` | Nepritomnost |

### Slot recovery

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| POST | `/slot-recovery/trigger` | Spusteni recovery pro zruseny slot |
| GET | `/slot-recovery/offers` | Aktivni nabidky |

### Export a PDF

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/pdf/invoice/:id` | PDF faktura |
| GET | `/pdf/report/:id` | PDF zprava |
| GET | `/export/appointments` | Export terminu |

### GDPR

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| POST | `/gdpr/consent` | Udeleni souhlasu |
| GET | `/gdpr/consents` | Prehled souhlasu |
| POST | `/gdpr/erasure-request` | Zadost o vymazani |
| GET | `/gdpr/data-export` | Export osobnich dat |

### Dalsi moduly

| Modul | Popis |
|-------|-------|
| `audit` | Audit log akci |
| `messages` | Komunikace klient-personal |
| `reminders` | Automaticke pripominky |
| `questionnaires` | Dotazniky |
| `exercise-library` | Knihovna cviku |
| `homework` | Domaci ukoly |
| `therapy-reports` | Zpravy z terapie |
| `intensive-therapy` | Intenzivni terapie |
| `intensive-blocks` | Vicedenne bloky |
| `insurance` | Pojisteni |
| `gamification` | Gamifikace a loyalty |
| `ratings` | Hodnoceni |
| `recommendations` | Doporuceni |
| `ai-summary` | AI souhrny |
| `video` | Video hovory |
| `search` | Globalni vyhledavani |
| `ical` | iCal export |
| `system-settings` | Systemova nastaveni |
