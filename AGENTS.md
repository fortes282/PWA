# AGENTS.md — PWA Přístav Radosti

## Credentials

Kompletní produkční env soubor se všemi secrets:

**`/tmp/PWA/.env.production`**

Persistentní záloha (přežije restart):
**`~/.openclaw/secrets/pwa-env-production`**

Obsahuje: JWT secrets, SMTP (WEDOS), SMSAPI, VAPID keys, Fio token, DB config, URL aplikace/API (`APP_URL`, `NEXT_PUBLIC_*` podle nasazení).

Pokud `/tmp/PWA/.env.production` neexistuje, zkopíruj z `~/.openclaw/secrets/pwa-env-production`.

## VPS (Contabo)

- **SSH**: `ssh root@109.123.243.52` — heslo v `~/.openclaw/secrets/vps-access`
- Projekt: `/opt/pristav/` — `docker compose restart api`
- Contabo panel: `https://new.contabo.com` — credentials v `~/.openclaw/secrets/vps-access`
- VNC záloha: `164.68.114.116:63181` — password v `~/.openclaw/secrets/vps-access`

## Deploy

- **Platforma:** vlastní VPS (Contabo), ne Render — aplikace běží v Dockeru v `/opt/pristav/`.
- **Na serveru:** po `git pull` např. `docker compose --env-file .env.production up -d --build --remove-orphans` (staging používá navíc `docker-compose.staging.yml`; viz `.github/workflows/deploy-vps.yml`).
- **GitHub Actions:** workflow *Deploy to VPS* (`deploy-vps.yml`) — secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, volitelně `VPS_BASE_URL` pro health check.
- **Veřejná adresa:** v tomto repu není pevně daná vlastní doména; URL řeš přes IP VPS, reverzní proxy nebo proměnné v `.env.production` / GitHub secrets podle skutečného nasazení.

## Stack

- Next.js 15 + Fastify + SQLite (Drizzle ORM) + Docker Compose
- Monorepo: apps/api, apps/web, packages/shared
