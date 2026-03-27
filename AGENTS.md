# AGENTS.md — PWA Přístav Radosti

## Credentials

Kompletní produkční env soubor se všemi secrets:

**`/tmp/PWA/.env.production`**

Persistentní záloha (přežije restart):
**`~/.openclaw/secrets/pwa-env-production`**

Obsahuje: JWT secrets, SMTP (WEDOS), SMSAPI, VAPID keys, Fio token, DB config, URL aplikace/API (`APP_URL`, `NEXT_PUBLIC_*` podle nasazení).

Pokud `/tmp/PWA/.env.production` neexistuje, zkopíruj z `~/.openclaw/secrets/pwa-env-production`.

## VPS (Contabo)

- **SSH (heslo)**: `ssh root@109.123.243.52` — heslo v `~/.openclaw/secrets/vps-access`
- **SSH (klíč, bez hesla — CI i ruční deploy):** privátní klíč `~/.ssh/id_ed25519_github_pristav`, veřejný `.pub` musí být na VPS v `root` → `~/.ssh/authorized_keys`. **Privátní klíč nikdy do gitu** — jen do GitHub secretu `VPS_SSH_KEY`. Test: `ssh -i ~/.ssh/id_ed25519_github_pristav root@109.123.243.52`
- Projekt: `/opt/pristav/` — `docker compose restart api`
- Contabo panel: `https://new.contabo.com` — credentials v `~/.openclaw/secrets/vps-access`
- VNC záloha: `164.68.114.116:63181` — password v `~/.openclaw/secrets/vps-access`

## Deploy

- **Asistent / agent — povinně:** nasazení **vždy přímo přes SSH** na VPS (příkaz níže). **Nikdy nespouštět deploy přes GitHub** — ani `gh workflow run`, ani záložka Actions, ani jiný GitHub trigger. Workflow *Deploy to VPS* v repu existuje jen jako volitelná záloha pro člověka mimo tento postup; pro práci v Cursoru ho nepoužívej.
- **Platforma:** vlastní VPS (Contabo), ne Render — aplikace běží v Dockeru v `/opt/pristav/`.
- **Na serveru:** po `git pull` např. `docker compose --env-file .env.production up -d --build --remove-orphans` (staging používá navíc `docker-compose.staging.yml`; viz `.github/workflows/deploy-vps.yml`).
- **SSH deploy (výchozí způsob):**
  ```bash
  ssh -i ~/.ssh/id_ed25519_github_pristav root@109.123.243.52 \
    'cd /opt/pristav && git pull origin main && docker compose --env-file .env.production up -d --build --remove-orphans'
  ```
- **GitHub Actions (jen reference, ne pro agenta):** `deploy-vps.yml` používá secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, volitelně `VPS_BASE_URL`. Chyba `Permission denied (publickey)` = špatný secret nebo chybí řádek v `authorized_keys` na serveru.
- **Veřejná adresa:** v tomto repu není pevně daná vlastní doména; URL řeš přes IP VPS, reverzní proxy nebo proměnné v `.env.production` podle skutečného nasazení.

## Testování (deploy-first)

- **Playwright E2E** spouštěj primárně **proti nasazené URL** (`BASE_URL` + `NEXT_PUBLIC_API_URL`), ne jako hlavní gate z čistého localhost — viz úvod [PWA_TEST_MATRIX.md](PWA_TEST_MATRIX.md) (sekce *Deploy-first*) a §8 příkazy proti VPS.

## Stack

- Next.js 15 + Fastify + SQLite (Drizzle ORM) + Docker Compose
- Monorepo: apps/api, apps/web, packages/shared
