# Deployment Guide — Přístav Radosti v2

## Prerequisites

- Docker Engine ≥ 24 + Docker Compose v2
- Domain DNS pointing to your server (A record for `pristav-radosti.cz`)
- SSL certificates (Let's Encrypt via Certbot, or manual)

---

## Quick Start (HTTP-only / Staging)

```bash
# 1. Clone
git clone git@github.com:fortes282/PWA.git /opt/pristav
cd /opt/pristav

# 2. Create environment file
cp .env.example .env.production
# Edit .env.production — fill in all required values (JWT_SECRET, SMTP, etc.)

# 3. Generate secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Use output for JWT_SECRET and JWT_REFRESH_SECRET

# 4. Start (HTTP-only for staging)
docker compose -f docker-compose.yml -f docker-compose.staging.yml \
  --env-file .env.production up -d --build
```

## Production (HTTPS)

```bash
# 1. Initial setup (same as staging steps 1-3)

# 2. Prepare SSL directory
mkdir -p nginx/ssl

# 3. Get initial certificate (HTTP must be accessible on port 80)
# Start nginx temporarily without SSL:
docker compose -f docker-compose.yml -f docker-compose.staging.yml \
  --env-file .env.production up -d nginx

# 4. Run Certbot
docker compose --env-file .env.production run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d pristav-radosti.cz -d www.pristav-radosti.cz \
  --email admin@pristav-radosti.cz --agree-tos --non-interactive

# 5. Copy certificates
cp /var/lib/docker/volumes/*certbot_conf*/_data/live/pristav-radosti.cz/fullchain.pem nginx/ssl/
cp /var/lib/docker/volumes/*certbot_conf*/_data/live/pristav-radosti.cz/privkey.pem nginx/ssl/

# 6. Start full production stack
docker compose --env-file .env.production up -d --build

# 7. Add certificate renewal cron on host:
#    0 */12 * * * docker compose -f /opt/pristav/docker-compose.yml \
#      --env-file /opt/pristav/.env.production run --rm certbot renew --quiet \
#      && docker compose -f /opt/pristav/docker-compose.yml exec nginx nginx -s reload
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | ✅ | — | Signing key for access tokens (min 64 chars) |
| `JWT_REFRESH_SECRET` | ✅ | — | Signing key for refresh tokens |
| `ALLOWED_ORIGINS` | ✅ | `http://localhost:3000` | Comma-separated CORS origins |
| `NEXT_PUBLIC_API_URL` | ✅ | `http://localhost:3001` | API URL visible to browser |
| `SMTP_HOST` | — | — | SMTP server for email |
| `SMTP_PORT` | — | `587` | SMTP port |
| `SMTP_USER` | — | — | SMTP username |
| `SMTP_PASS` | — | — | SMTP password |
| `SMSAPI_TOKEN` | — | — | SMSAPI.com API token |
| `VAPID_PUBLIC_KEY` | — | — | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | — | — | Web Push VAPID private key |
| `FIO_API_KEY` | — | — | FIO Bank API key |
| `DATABASE_PATH` | — | `/app/data/pristav.db` | SQLite DB path |
| `BACKUP_DIR` | — | `/app/data/backups` | Backup directory |
| `BACKUP_KEEP_DAYS` | — | `14` | Days to keep backups |
| `REMINDER_HOURS` | — | `24` | Hours before appointment for reminders |

---

## Database Backup

Automated backup script at `scripts/backup.sh`:

```bash
# Add to host crontab:
0 3 * * * docker compose -f /opt/pristav/docker-compose.yml \
  exec api sh /app/scripts/backup.sh
```

Backups are stored in the `api_data` volume under `/app/data/backups/`.

---

## Monitoring

- **Health check**: `GET /health` → `{ status: "ok" }`
- **Ping**: `GET /health/ping` → `{ pong: true }` (lightweight)
- **Detailed**: `GET /health/detailed` → DB status, table stats, feature flags
- **API docs**: `GET /docs` → Swagger UI

---

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   nginx     │────▶│   Next.js   │     │  Fastify    │
│   :80/:443  │     │   web:3000  │     │  api:3001   │
│             │────▶│             │     │             │
│  /api/* ────│─────│─────────────│────▶│  SQLite     │
└─────────────┘     └─────────────┘     └─────────────┘
```

- nginx reverse proxy handles TLS termination, static caching, gzip
- `/api/*` routed directly to Fastify backend
- Everything else served by Next.js
- SQLite stored in Docker volume `api_data`

---

## Updating

```bash
cd /opt/pristav
git pull
docker compose --env-file .env.production up -d --build
```

Migrations run automatically on API startup.

---

## Seed Data (First Deploy)

On first start, the database is created empty. To populate demo data:

```bash
docker compose exec api node dist/db/seed.js
```

Demo accounts:
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@pristav.cz | Admin123! |
| Recepce | recepce@pristav.cz | Recepce123! |
| Terapeut | terapeut@pristav.cz | Terapeut123! |
| Klient | klient@pristav.cz | Klient123! |
