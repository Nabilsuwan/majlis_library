#!/bin/sh
# Copies the whole database from Neon into the NAS database.
# Run on the NAS, from the project folder, AFTER `docker compose up -d`:
#
#   sh migrate/migrate-db.sh 'postgresql://USER:PASSWORD@HOST/neondb?sslmode=require'
#
# The Neon connection string is Vercel's DATABASE_URL (or Neon dashboard ->
# Connection Details). Safe to re-run: it replaces the NAS copy each time.
set -e

NEON_URL="$1"
if [ -z "$NEON_URL" ]; then
  echo "Usage: sh migrate/migrate-db.sh '<Neon connection string>'"
  exit 1
fi

. ./.env
DUMP_DIR="${NAS_ROOT:-/share/Majlis}/backups"
DUMP="$DUMP_DIR/neon-export-$(date +%Y%m%d-%H%M).dump"
mkdir -p "$DUMP_DIR"

echo "1/3  Exporting from Neon..."
docker run --rm -v "$DUMP_DIR:/out" postgres:17-alpine \
  pg_dump "$NEON_URL" -Fc --no-owner --no-acl -f "/out/$(basename "$DUMP")"
echo "     saved $DUMP"

echo "2/3  Importing into the NAS database (replacing what's there)..."
docker compose exec -T db psql -U majlis -d majlis -q -c \
  "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
# Neon-specific settings can produce a few harmless warnings here.
docker compose exec -T db pg_restore -U majlis -d majlis --no-owner --no-acl \
  < "$DUMP" || echo "     (pg_restore reported warnings — check the counts below)"

echo "3/3  Checking..."
docker compose exec -T db psql -U majlis -d majlis -c "
  SELECT 'books' AS table_name, count(*) FROM books
  UNION ALL SELECT 'authors', count(*) FROM authors
  UNION ALL SELECT 'publishers', count(*) FROM publishers
  UNION ALL SELECT 'categories', count(*) FROM categories
  UNION ALL SELECT 'staff', count(*) FROM staff;"

echo "Done. Compare these counts with the live site, then run:"
echo "  docker compose exec app node scripts/migrate-covers.mjs"
