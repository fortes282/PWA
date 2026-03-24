# AGENTS.md — PWA Přístav Radosti

## Credentials

Kompletní produkční env soubor se všemi secrets:

**`/tmp/PWA/.env.production`**

Persistentní záloha (přežije restart):
**`~/.openclaw/secrets/pwa-env-production`**

Obsahuje: JWT secrets, SMTP (WEDOS), SMSAPI, VAPID keys, Fio token, Render token, DB config.

Pokud `/tmp/PWA/.env.production` neexistuje, zkopíruj z `~/.openclaw/secrets/pwa-env-production`.

## VPS (Contabo)

- **SSH**: `ssh root@109.123.243.52` — heslo v `~/.openclaw/secrets/vps-access`
- Projekt: `/opt/pristav/` — `docker compose restart api`
- Contabo panel: `https://new.contabo.com` — credentials v `~/.openclaw/secrets/vps-access`
- VNC záloha: `164.68.114.116:63181` — password v `~/.openclaw/secrets/vps-access`

## Deploy

- Platforma: Render
- Doména: pristav-radosti.cz
- Render token: v `.env.production` (poslední řádek)

## Stack

- Next.js 15 + Fastify + SQLite (Drizzle ORM) + Docker Compose
- Monorepo: apps/api, apps/web, packages/shared
