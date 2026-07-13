#!/bin/bash
# Daily MySQL backup for 425store (run via cPanel cron)
# Example cron (daily 02:15):
#   15 2 * * * /home/USER/backup/sombat_backup.sh >> /home/USER/backup/backup.log 2>&1
#
# Fill credentials below OR source from a file outside web root.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/backup/sombat}"
KEEP_DAYS="${KEEP_DAYS:-14}"
DB_HOST="${DB_HOST:-localhost}"
DB_NAME="${DB_NAME:-changeme}"
DB_USER="${DB_USER:-changeme}"
DB_PASS="${DB_PASS:-changeme}"

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d_%H%M%S)
OUT="$BACKUP_DIR/sombat_${STAMP}.sql.gz"

mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" \
  --single-transaction --routines --triggers \
  "$DB_NAME" | gzip -c > "$OUT"

# prune old backups
find "$BACKUP_DIR" -name 'sombat_*.sql.gz' -mtime +"$KEEP_DAYS" -delete

echo "[$(date -Iseconds)] backup ok: $OUT"
