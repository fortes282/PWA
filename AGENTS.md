# AGENTS.md — PWA Přístav Radosti

## Credentials

Kompletní produkční env soubor se všemi secrets:

**`/tmp/PWA/.env.production`**

Persistentní záloha (přežije restart):
**`~/.openclaw/secrets/pwa-env-production`**

Obsahuje: JWT secrets, SMTP (WEDOS), SMSAPI, VAPID keys, Fio token, Render token, DB config.

Pokud `/tmp/PWA/.env.production` neexistuje, zkopíruj z `~/.openclaw/secrets/pwa-env-production`.

## Deploy

- Platforma: Render
- Doména: pristav-radosti.cz
- Render token: v `.env.production` (poslední řádek)

## Stack

- Next.js 15 + Fastify + SQLite (Drizzle ORM) + Docker Compose
- Monorepo: apps/api, apps/web, packages/shared
