# DEPLOYMENT.md — Přístav Radosti v2

Průvodce produkčním nasazením na VPS (Ubuntu 22.04+) nebo Railway.

---

## 1. Příprava VPS

```bash
# Aktualizace a základní nástroje
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl docker.io docker-compose-v2 certbot

# Docker bez sudo
sudo usermod -aG docker $USER
newgrp docker
```

---

## 2. Klonování repozitáře

```bash
git clone git@github.com:fortes282/PWA.git /opt/pristav
cd /opt/pristav
```

---

## 3. Konfigurace prostředí

```bash
# Zkopírujte a upravte .env
cp .env.example .env
nano .env
```

**Povinné proměnné:**

```env
# Vygenerujte: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=<64+ char hex string>
JWT_REFRESH_SECRET=<jiný 64+ char hex string>

ALLOWED_ORIGINS=https://pristav-radosti.cz,https://www.pristav-radosti.cz
NEXT_PUBLIC_API_URL=https://pristav-radosti.cz/api

# SMTP (WEDOS nebo jiný provider)
SMTP_HOST=wes1-smtp.wedos.net
SMTP_PORT=587
SMTP_USER=zadosti@pristav-radosti.cz
SMTP_PASS=<heslo>
SMTP_FROM="Přístav Radosti" <zadosti@pristav-radosti.cz>

# SMS (SMSAPI.com)
SMSAPI_TOKEN=<Bearer token z SMSAPI>
SMSAPI_SENDER=PristavR   # volitelné, musí být schváleno v SMSAPI

# Web Push (VAPID) — vygenerujte níže
VAPID_SUBJECT=mailto:admin@pristav-radosti.cz
VAPID_PUBLIC_KEY=<vygenerovat>
VAPID_PRIVATE_KEY=<vygenerovat>
```

**Generování VAPID klíčů:**
```bash
npx web-push generate-vapid-keys
# Zkopírujte oba klíče do .env
```

---

## 4. SSL certifikát (Let's Encrypt)

```bash
# Spusťte nginx jen pro HTTP challenge (bez HTTPS bloku)
# Dočasně zakomentujte HTTPS server v nginx/nginx.conf a odkomentujte HTTP proxy bloky

# Vytvořte adresář pro certbot
mkdir -p /opt/pristav/nginx/certbot

# Obstarání certifikátu
certbot certonly --webroot \
  -w /opt/pristav/nginx/certbot \
  -d pristav-radosti.cz \
  -d www.pristav-radosti.cz \
  --email admin@pristav-radosti.cz \
  --agree-tos \
  --non-interactive

# Zkopírujte certifikáty do nginx/ssl/
mkdir -p /opt/pristav/nginx/ssl
cp /etc/letsencrypt/live/pristav-radosti.cz/fullchain.pem /opt/pristav/nginx/ssl/
cp /etc/letsencrypt/live/pristav-radosti.cz/privkey.pem /opt/pristav/nginx/ssl/
chmod 600 /opt/pristav/nginx/ssl/privkey.pem
```

---

## 5. Spuštění

```bash
cd /opt/pristav

# Build a spuštění
docker compose up -d --build

# Sledování logů
docker compose logs -f

# Inicializace databáze (pouze první spuštění)
docker compose exec api node dist/db/migrate.js
docker compose exec api node dist/db/seed.js
```

**Ověření:**
```bash
# Health check
curl https://pristav-radosti.cz/api/health

# Detailed health (DB ping + feature flags)
curl https://pristav-radosti.cz/api/health/detailed
```

---

## 6. Demo účty (seed data)

| Role | Email | Heslo |
|------|-------|-------|
| Admin | admin@pristav.cz | Admin123! |
| Recepce | recepce@pristav.cz | Recepce123! |
| Terapeut | terapeut@pristav.cz | Terapeut123! |
| Klient | klient@pristav.cz | Klient123! |

> ⚠️ V produkci ihned změňte hesla nebo smažte seed uživatele.

---

## 7. Záloha databáze

```bash
# Ruční záloha
docker compose exec api sh /app/scripts/backup.sh

# Automatická záloha přes cron (přidejte na host)
crontab -e
# Přidejte:
0 3 * * * cd /opt/pristav && docker compose exec -T api sh /app/scripts/backup.sh >> /var/log/pristav-backup.log 2>&1
```

Zálohy se ukládají do Docker volume `api_data` → `/app/data/backups/`.
Uchovávají se 14 dní (nastavitelné přes `BACKUP_KEEP_DAYS`).

---

## 8. Obnova certifikátu (Let's Encrypt)

```bash
# Ruční obnova
certbot renew

# Po obnově zkopírujte nové certifikáty
cp /etc/letsencrypt/live/pristav-radosti.cz/fullchain.pem /opt/pristav/nginx/ssl/
cp /etc/letsencrypt/live/pristav-radosti.cz/privkey.pem /opt/pristav/nginx/ssl/
docker compose exec nginx nginx -s reload

# Automatická obnova přes cron (certbot ji dělá sám, ale nginx reload je potřeba)
# Přidejte do /etc/cron.d/certbot-reload:
0 4 * * 1 cp /etc/letsencrypt/live/pristav-radosti.cz/*.pem /opt/pristav/nginx/ssl/ && docker compose -f /opt/pristav/docker-compose.yml exec nginx nginx -s reload
```

---

## 9. Aktualizace aplikace

```bash
cd /opt/pristav
git pull origin main
docker compose up -d --build
# Migrace (pokud jsou nové)
docker compose exec api node dist/db/migrate.js
```

---

## 10. Monitoring

| Endpoint | Popis |
|----------|-------|
| `GET /api/health` | Základní health check (Docker healthcheck) |
| `GET /api/health/detailed` | DB ping, feature flags (email/SMS/push/FIO), uptime |

Doporučené: UptimeRobot nebo Betterstack — pingovat `/api/health` každých 5 minut.

---

## 11. Troubleshooting

```bash
# Logy API
docker compose logs api --tail=100

# Logy nginx
docker compose logs nginx --tail=50

# Restart služby
docker compose restart api

# Shell v kontejneru
docker compose exec api sh

# Kontrola databáze
docker compose exec api sqlite3 /app/data/pristav.db ".tables"
```

---

## 12. Railway deployment (alternativa k VPS)

1. Fork repozitáře
2. Vytvoř nový projekt v Railway → Import from GitHub
3. Přidej dvě služby: `apps/api` a `apps/web`
4. Nastav Root Directory pro každou službu
5. Přidej env proměnné (stejné jako .env.example)
6. Railway automaticky builduje a deployuje při push na main

> **Poznámka:** Railway nemá perzistentní storage pro SQLite. Pro produkci doporučujeme VPS s Docker Compose, nebo migraci na PostgreSQL (Drizzle ORM to podporuje).
