#!/usr/bin/env bash
# SQLite backup script for Pristav Radosti
# Run as cron: 0 3 * * * /app/scripts/backup.sh

set -euo pipefail

DB_PATH="${DATABASE_PATH:-/app/data/pristav.db}"
BACKUP_DIR="${BACKUP_DIR:-/app/data/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-7}"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/pristav_$DATE.db"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "[backup] ERROR: Database not found at $DB_PATH"
  exit 1
fi

# Use SQLite online backup (safe for concurrent access)
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

echo "[backup] ✓ Backup created: $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"

# Remove backups older than KEEP_DAYS
find "$BACKUP_DIR" -name "pristav_*.db" -mtime "+$KEEP_DAYS" -delete
echo "[backup] ✓ Cleaned backups older than $KEEP_DAYS days"

echo "[backup] Done. Backups in $BACKUP_DIR:"
ls -lh "$BACKUP_DIR" | tail -5
