# Bezpecnost

## Autentizace

### JWT tokeny
- Access token: 15 min expirace, v httpOnly secure cookie (`accessToken`) + Bearer header
- Refresh token: 30 dni, httpOnly secure cookie (`refreshToken`), ulozeny jako hash v DB
- Token rotace: pri refresh se stary token smaze a vytvori novy
- Cookie atributy: `httpOnly`, `secure` (produkce), `sameSite: strict`, `path: /`

### Hesla
- Hashovani: SHA-256 + salt (12 znaku, format `salt:hash`)
- Account lockout: 5 neuspesnych pokusu → 15 min zamknuti

### 2FA (TOTP)
- Standard TOTP (Google Authenticator, Authy, apod.)
- 8 zaloznich kodu (SHA-256 hash, single-use)
- Setup: `POST /auth/2fa/setup` → QR kod
- Verifikace: `POST /auth/2fa/verify` s pending tokenem (5 min platnost)

### API klice
- Format: `pr_live_` + 32 random hex bajtu
- Ulozeni: SHA-256 hash (plaintext se zobrazi jen pri vytvoreni)
- Scoped opravneni: JSON pole scopu (napr. `["admin:backup:write"]`)
- Wildcard: `"*"` pro plny pristup
- Expirace + tracking posledniho pouziti

## Autorizace (RBAC)

Kazdy route chraneny `requireRole()` middlewarem:

```
CLIENT    → vlastni data, booking
RECEPTION → klienti, terminy, billing
EMPLOYEE  → vlastni kalendar, lekarske zpravy
ADMIN     → plny pristup
```

API key requesty: scope guard overuje `requiredScopes` per endpoint.

## Sifrovani zdravotnich dat

- Algoritmus: AES-256-GCM (AEAD — autentizovane sifrovani)
- Nahodny 12-byte IV per zaznam
- Format: `enc:v1:` + base64(IV + authTag + ciphertext)
- Klic: `HEALTH_DATA_ENCRYPTION_KEY` (64 hex znaku, povinny v produkci)
- Dev fallback: deterministicky klic (s warningem v logu)
- Pristup logovany v `healthRecordAccessLog` (accessor, akce, IP, userAgent)

## Rate limiting

| Scope | Limit | Okno |
|-------|-------|------|
| Globalni (per IP) | 100 req | 1 min |
| Login (per IP) | 5 pokusu | 15 min |
| Public booking (per IP) | 8 req | 10 min |

Po prekroceni: HTTP 429 s `retryAfter` hlavickou.

## CORS

- Whitelist originu z `ALLOWED_ORIGINS` env var (carkou oddelene)
- `credentials: true` (cookies)
- Dev default: `http://localhost:3000`

## Security headers (Helmet)

- Content-Security-Policy: `'self'`, `data:` pro obrazky, `'unsafe-inline'` pro styly
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin
- Strict-Transport-Security (HTTPS)

## GDPR compliance

- `gdprConsents` — zaznam udeleni/odvolani souhlasu (s IP a userAgent)
- `gdprErasureRequests` — pravo byt zapomenut (zadost o vymazani)
- `GET /gdpr/data-export` — export osobnich dat
- `healthRecordAccessLog` — kompletni audit pristupu ke zdravotnim datum

## Audit

- `auditLog` — vsechny dulezite akce (vytvoreni, zmena, smazani)
- `profileLog` — zmeny na urovni poli (kdo, co, kdy)
- `loginHistory` — vsechna prihlaseni (IP, userAgent, uspech/neuspech)
- `notificationLog` — audit odeslanych zprav

## Incident response

### Kompromitovany ucet
1. `POST /auth/logout-all` — odhlaseni ze vsech zarizeni
2. Reset hesla
3. Zkontrolovat `loginHistory` a `auditLog`
4. Deaktivace uctu pokud je treba

### Uniklý API klic
1. Deaktivace klice v admin panelu (nebo primo v DB: `is_active = false`)
2. Zkontrolovat `auditLog` pro akce provedene klícem
3. Vygenerovat novy klic

### Podezrely rate limit abuse
1. Zvysit login rate limit docasne: `AUTH_LOGIN_RATE_LIMIT_MAX`
2. Zkontrolovat `loginHistory` pro podezrele IP
3. Blokovat IP na urovni nginx/firewall

## Produkci checklist

- [ ] `JWT_SECRET` — 64 hex znaku, unikatni
- [ ] `JWT_REFRESH_SECRET` — 64 hex znaku, unikatni
- [ ] `HEALTH_DATA_ENCRYPTION_KEY` — 64 hex znaku
- [ ] `ALLOWED_ORIGINS` — jen produkci domeny
- [ ] `COOKIE_SECURE=true`
- [ ] HTTPS (Let's Encrypt via Certbot)
- [ ] PostgreSQL misto SQLite
- [ ] SMTP nakonfigurovano (pro password reset)
- [ ] VAPID klice vygenerovany
- [ ] Zalohovani DB aktivni (pg-backup service)
