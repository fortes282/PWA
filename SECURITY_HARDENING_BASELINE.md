# Security Hardening Baseline

Tento dokument popisuje aktuální bezpečnostní baseline po hardening refactoru.

## Auth & Session

- Frontend nepersistuje access token do `localStorage` ani `sessionStorage`.
- Session je řízena přes httpOnly cookies (`accessToken`, `refreshToken`) + refresh flow.
- Refresh tokeny se rotují při každém `POST /auth/refresh`.
- Přidán endpoint `POST /auth/logout-all` pro invalidaci všech refresh session.
- `POST /auth/login` a 2FA login flow sjednocují životnost refresh tokenu přes `AUTH_REFRESH_TOKEN_DAYS`.

## API Boundary

- Public route allowlist je explicitně zpřísněný v auth pluginu.
- API key autentizace podporuje scope guard přes route config `requiredScopes`.
- Kritické systémové endpointy (`/admin/api-keys*`, `/admin/backup*`, `/metrics`) mají scope enforcement.

## Data Security

- Produkce vyžaduje `HEALTH_DATA_ENCRYPTION_KEY`.
- Password reset tokeny jsou ukládány hashovaně (SHA-256), ne v plaintext podobě.
- Reset hesla invaliduje refresh tokeny uživatele.

## Anti-abuse

- Veřejné rezervace (`POST /booking/public`) mají rate limit, honeypot a základní timing heuristiku.
- Nginx přidává samostatný rate limit pro public booking endpoint.

## Breaking/Operational Notes

- Monitoring endpoint `/metrics` už není veřejný; vyžaduje auth (JWT/API key) a scope `system:metrics:read`.
- Klientské formuláře pro public booking mají posílat prázdný honeypot field `website` a volitelně `formStartedAt`.
- Pro produkci je povinné správně nastavit `COOKIE_SECURE=true`.
