# Security Incident Runbook

## 1) Compromised Account

1. Zablokuj účet (`is_active = false`) nebo změň heslo přes admin flow.
2. Proveď `POST /auth/logout-all` (nebo DB delete `refresh_tokens` pro user).
3. Prověř `GET /audit` a `GET /login-history` na neobvyklé přístupy.
4. Zkontroluj změny kritických objektů (uživatelé, fakturace, API keys).

## 2) Leaked API Key

1. Okamžitě revoke: `DELETE /admin/api-keys/:id`.
2. Vystav nový klíč s minimálním scope (least privilege).
3. Vyhodnoť `lastUsedAt`, audit log a downstream zásahy.
4. Pokud byl klíč s write scopes, proveď kontrolu integrity dat.

## 3) Password Reset Abuse

1. Ověř frekvenci `POST /auth/forgot-password` podle IP/user.
2. Dočasně zpřísni `PUBLIC_BOOKING_RATE_LIMIT_*` / auth rate limity.
3. U zasažených uživatelů proveď forced reset + logout all sessions.

## 4) Recovery & Postmortem

1. Zaznamenej timeline incidentu (detekce, mitigace, recovery).
2. Přidej regression test pro root cause.
3. Zvaž scope tightening, kratší expirace, nebo další detekční metriky.
