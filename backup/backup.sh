#!/bin/sh
# Nightly database backup. Runs inside the "backup" container.
# Writes /backups/majlis-YYYY-MM-DD.dump and deletes dumps older than KEEP_DAYS.
# Restore with:  pg_restore --clean --no-owner -d majlis <file>

BACKUP_TIME="${BACKUP_TIME:-0200}"
KEEP_DAYS="${KEEP_DAYS:-30}"

do_backup() {
  file="/backups/majlis-$(date +%Y-%m-%d).dump"
  if pg_dump -Fc -f "$file.tmp" && mv "$file.tmp" "$file"; then
    echo "$(date '+%F %T') backup OK: $file ($(du -h "$file" | cut -f1))"
  else
    rm -f "$file.tmp"
    echo "$(date '+%F %T') BACKUP FAILED"
  fi
  find /backups -name 'majlis-*.dump' -mtime +"$KEEP_DAYS" -delete
}

echo "$(date '+%F %T') backup service started; daily at $BACKUP_TIME, keeping $KEEP_DAYS days"
# One backup right away, so a fresh install is protected from day one.
do_backup

while true; do
  if [ "$(date +%H%M)" = "$BACKUP_TIME" ]; then
    do_backup
    sleep 61
  fi
  sleep 30
done
