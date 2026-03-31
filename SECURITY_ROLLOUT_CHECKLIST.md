# Security Rollout Checklist

## Staging

1. Nastav nové env proměnné:
   - `HEALTH_DATA_ENCRYPTION_KEY`
   - `AUTH_REFRESH_TOKEN_DAYS`
   - `PUBLIC_BOOKING_RATE_LIMIT_MAX`
   - `PUBLIC_BOOKING_RATE_LIMIT_WINDOW`
2. Proveď deploy na staging.
3. Ověř smoke:
   - login + refresh + logout + logout-all
   - 2FA login flow
   - `/health`, `/health/detailed`, `/docs`
   - `/metrics` dostupný jen s auth + scope
4. Spusť API security test subset.

## Production

1. Nasazuj mimo špičku, se zálohou DB před deployem.
2. Aktivuj monitorování auth chyb (401/403/429) a login lockout trendů.
3. První 24h sleduj:
   - login success rate
   - refresh failure rate
   - public booking rejection rate

## Rollback

1. Pokud dojde k regresi loginu:
   - rollback image/commit
   - restart `api` + `web` kontejnery
2. Pokud je problém pouze v anti-abuse:
   - dočasně zvýšit `PUBLIC_BOOKING_RATE_LIMIT_*`
3. Pokud je problém v scope enforcement:
   - vytvořit nový API klíč s adekvátním scope
   - revoke původní klíč po stabilizaci
