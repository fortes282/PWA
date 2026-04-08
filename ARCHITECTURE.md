# Architektura

Monorepo se tremi workspace balicky: `apps/api`, `apps/web`, `packages/shared`.

## Adresarova struktura

```
apps/
├── api/                  # Fastify 4 REST API (TypeScript)
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts          # Drizzle ORM schema (48 tabulek)
│   │   │   ├── index.ts           # DB connection (PG / SQLite fallback)
│   │   │   ├── migrate.ts         # Migrace
│   │   │   ├── seed.ts            # Demo data
│   │   │   └── migrate-sqlite-to-pg.ts  # SQLite -> PostgreSQL migrace
│   │   ├── plugins/
│   │   │   └── auth.ts            # JWT + API key autentizace (preHandler hook)
│   │   ├── routes/                # 70+ route modulu
│   │   ├── services/              # Email (Nodemailer), SMS (SMSAPI), Push (VAPID)
│   │   └── __tests__/             # Integration testy (Vitest)
│   ├── Dockerfile
│   └── vitest.config.ts
│
├── web/                  # Next.js 15 + React 19 frontend
│   ├── src/
│   │   ├── app/                   # App Router stranky
│   │   │   ├── admin/             # 31 stranek
│   │   │   ├── client/            # 20 stranek
│   │   │   ├── employee/          # 15 stranek
│   │   │   ├── reception/         # 15 stranek
│   │   │   ├── login/
│   │   │   ├── booking/           # Verejna rezervace
│   │   │   └── ...
│   │   ├── components/            # UI komponenty
│   │   ├── lib/
│   │   │   ├── api.ts             # Centralizovany API klient (apiFetch)
│   │   │   ├── auth.tsx           # AuthContext + AuthProvider
│   │   │   └── __tests__/
│   │   ├── mocks/                 # MSW mock handlery
│   │   └── test/                  # Test setup
│   ├── e2e/                       # Playwright E2E testy
│   ├── Dockerfile
│   ├── playwright.config.ts
│   └── vitest.config.ts
│
packages/
└── shared/               # Sdilene Zod schemas
    └── src/schemas/
        ├── auth.ts               # LoginSchema, 2FA schemas
        ├── appointment.ts
        ├── credit.ts
        ├── invoice.ts
        ├── notification.ts
        ├── room.ts
        ├── service.ts
        ├── slot-recovery.ts
        ├── user.ts
        └── waitlist.ts
```

## Databaze

Produkce: **PostgreSQL 16**. Dev/staging fallback: **SQLite** (better-sqlite3).
ORM: **Drizzle ORM** — schema definovano v `apps/api/src/db/schema.ts`.

Prepinani: pokud existuje `DATABASE_URL` env var, pouzije se PostgreSQL; jinak SQLite na `DATABASE_PATH` (default `/app/data/pristav.db`).

### Prehled tabulek (48)

#### Uzivatele a autentizace
| Tabulka | Ucel |
|---------|------|
| `users` | Uzivatele (email, passwordHash, role, phone, totpSecret, totpEnabled, totpBackupCodes, insuranceNumber, gdprFields, behaviorScore) |
| `refreshTokens` | Aktivni refresh tokeny (token hash, userId, expiresAt) |
| `passwordResets` | Tokeny pro reset hesla |
| `loginHistory` | Log prihlaseni (IP, userAgent, success) |
| `apiKeys` | API klice (key_hash SHA-256, scopes JSON, expires_at) |

#### Terminy a planovani
| Tabulka | Ucel |
|---------|------|
| `appointments` | Terminy (clientId, employeeId, serviceId, startTime, endTime, status, price, cancellationReason, cancellationRiskScore) |
| `appointmentSeries` | Opakovane serie (frekvence WEEKLY/BIWEEKLY) |
| `appointmentTemplates` | Sablony opakovanych sezeni |
| `openSlots` | Dostupne casove sloty |
| `workingHours` | Pracovni hodiny zamestnancu (den, od-do) |
| `timeOffBlocks`, `timeOffV2` | Nepritomnost zamestnancu |

#### Sluzby a finance
| Tabulka | Ucel |
|---------|------|
| `services` | Sluzby (nazev, cena, trvani, kategorie) |
| `invoices` | Faktury (typ: THERAPY/QUOTE/FOUNDATION/GENERAL, status: DRAFT/SENT/PAID/OVERDUE/CANCELLED) |
| `invoiceItems` | Polozky faktur |
| `creditTransactions` | Kreditni transakce (PURCHASE/USE/REFUND/ADJUSTMENT) |
| `fioTransactions` | FIO banka transakce (automaticke parovani s fakturami) |

#### Pojisteni
| Tabulka | Ucel |
|---------|------|
| `insuranceCompanies` | Pojistovny |
| `insuranceProcedures` | Pojistovaci vykony |
| `insuranceClaims` | Naroky pojisteni |
| `insuranceBatches` | Davkove zpracovani |

#### Zdravotni zaznamy
| Tabulka | Ucel |
|---------|------|
| `healthRecords` | Zdravotni karta (krevni skupina, alergie, diagnozy, rehabilitacni cile) — sifrovano AES-256-GCM |
| `medicalReports` | Lekarske zpravy |
| `behaviorEvents` | Behavioralni udalosti (LATE_CANCEL, ON_TIME, apod.) |
| `therapyReports` | Zpravy z terapie |

#### Komunikace a notifikace
| Tabulka | Ucel |
|---------|------|
| `notifications` | Notifikace (typy: APPOINTMENT_CONFIRMED/REMINDER/CANCELLED, WAITLIST_AVAILABLE, INVOICE, GENERAL) |
| `notificationPreferences` | Preference notifikaci per uzivatel |
| `notificationLog` | Audit log odeslanych zprav |
| `messages` | Komunikace klient-personal |
| `waitlist` | Cekaci listina (status: WAITING/NOTIFIED/BOOKED/CANCELLED) |

#### Engagement a gamifikace
| Tabulka | Ucel |
|---------|------|
| `loyaltyPoints` | Vernostni body |
| `wellbeingSurveys` | Dotazniky pohody |

#### Compliance a audit
| Tabulka | Ucel |
|---------|------|
| `auditLog` | Kompletni audit log akci |
| `profileLog` | Historie zmen na urovni poli |
| `gdprConsents` | GDPR souhlasy (typ, udeleni, odvolani, IP) |
| `gdprErasureRequests` | Zadosti o vymazani (pravo byt zapomenut) |
| `healthRecordAccessLog` | Pristup ke zdravotnim zaznamum (READ/UPDATE/DELETE) |

#### Dalsie
| Tabulka | Ucel |
|---------|------|
| `intensiveBlocks` | Vicedenne terapeuticke bloky |
| `intensiveBlockEnrollments` | Zapisy do intenzivnich bloku |
| `emergencyContacts` | Nouzove kontakty |
| `sosActivations` | SOS aktivace |
| `systemSettings` | Systemova nastaveni (key-value) |
| `rooms` | Mistnosti (nazev, kapacita) |

## Fastify middleware chain

Pluginy registrovane v `apps/api/src/server.ts` v tomto poradi:

| Plugin | Konfigurace | Ucel |
|--------|-------------|------|
| `@fastify/swagger` | OpenAPI 3.0 | API dokumentace |
| `@fastify/swagger-ui` | routePrefix: `/docs` | Swagger UI |
| `@fastify/compress` | gzip/brotli, threshold 1 KB | Komprese odpovedi |
| `@fastify/helmet` | CSP: `'self'`, `data:` obrazky | Bezpecnostni hlavicky |
| `@fastify/rate-limit` | 100 req/min (1M v CI) | Globalni rate limit per IP |
| `@fastify/cors` | origin z `ALLOWED_ORIGINS`, credentials: true | CORS |
| `@fastify/cookie` | — | Parsovani cookies |
| `@fastify/jwt` | secret: `JWT_SECRET`, cookie: `accessToken` | JWT verifikace |
| `@fastify/static` | prefix: `/avatars/`, `/data/homework-media/` | Staticke soubory |
| `authPlugin` (custom) | — | JWT/API key auth preHandler |

### Custom hooks

| Hook | Kdy | Co dela |
|------|-----|---------|
| `preHandler` (auth) | Kazdy request | Overuje JWT nebo API key, naplni `request.auth` |
| `preHandler` (scope guard) | API key requesty | Kontroluje `requiredScopes` |
| `preHandler` (login rate limit) | `POST /auth/login` | 5 pokusu / 15 min per IP |
| `onRequest` | Kazdy request | Zachyti cas zacatku pro metriky |
| `onResponse` | Kazdy request | Zaznamenava latenci per route |
| `onSend` | `GET /services`, `/docs` | Cache hlavicky (60s services, 1h docs) |

### Error handling

Globalni error handler formatuje chyby:

```json
{
  "error": "Error",
  "message": "popis chyby",
  "statusCode": 400
}
```

- 4xx: logovano na WARN urovni
- 5xx: logovano na ERROR urovni, v produkci skryty interni detaily
- Validace: Zod schemas + `safeParse` → 400 s flatten errors

## Frontend API klient

Centralizovany v `apps/web/src/lib/api.ts`:

```typescript
// Pouziti
const data = await api.get('/appointments');
const result = await api.post('/auth/login', { email, password });
const blob = await api.getBlob('/pdf/invoice/123');
```

- Access token drzen **v pameti** (ne localStorage)
- Vsechny requesty s `credentials: "include"` (cookies)
- Pri 401: automaticky `POST /auth/refresh`, retry puvodni request
- Metody: `api.get`, `api.post`, `api.patch`, `api.put`, `api.delete`, `api.getBlob`

## Frontend routing a ochrana

`RouteGuard` komponenta obaluje chranene stranky:
- Cte `AuthContext` (user + isLoading stav)
- Neprihlaseny → redirect na `/login`
- Nedostatecna role → redirect na `/unauthorized`
- Kazda stranka definuje `allowedRoles` prop

## Docker infrastruktura

| Service | Image | Port | Ucel |
|---------|-------|------|------|
| `postgres` | postgres:16-alpine | 5432 | Databaze |
| `pg-backup` | postgres:16-alpine | — | Denni `pg_dump` ve 02:30 UTC, 7 rotaci |
| `api` | Custom (Node 22) | 3001 | Fastify API |
| `web` | Custom (Node 22) | 3000 | Next.js frontend |
| `nginx` | nginx:1.25-alpine | 80, 443 | Reverse proxy + SSL |
| `certbot` | certbot:latest | — | Let's Encrypt obnova |

Volumes: `pg_data`, `pg_backups`, `api_data` (avatary, homework media, SQLite), `certbot_conf`, `certbot_www`.
