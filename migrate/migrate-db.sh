#!/bin/sh
# Copies the whole database from Neon into the NAS database.
# Run on the NAS, from the project folder, AFTER `docker compose up -d`:
#
#   sh migrate/migrate-db.sh 'postgresql://USER:PASSWORD@HOST/neondb?sslmode=require'
#   sh migrate/migrate-db.sh /share/Majlis/backups/neon-export-....dump   (reuse an export)
#
# The Neon connection string is Vercel's DATABASE_URL (or Neon dashboard ->
# Connect). Safe to re-run: it replaces the NAS copy each time.
set -e

SOURCE="$1"
if [ -z "$SOURCE" ]; then
  echo "Usage: sh migrate/migrate-db.sh '<Neon connection string>' | <existing .dump file>"
  exit 1
fi

. ./.env
DUMP_DIR="${NAS_ROOT:-/share/Majlis}/backups"
mkdir -p "$DUMP_DIR"

if [ -f "$SOURCE" ]; then
  DUMP="$SOURCE"
  echo "1/3  Using existing export $DUMP"
else
  DUMP="$DUMP_DIR/neon-export-$(date +%Y%m%d-%H%M).dump"
  echo "1/3  Exporting from Neon..."
  docker run --rm -v "$DUMP_DIR:/out" postgres:18-alpine \
    pg_dump "$SOURCE" -Fc --no-owner --no-acl -f "/out/$(basename "$DUMP")"
  echo "     saved $DUMP"
fi

echo "2/3  Importing into the NAS database (replacing what's there)..."
PSQL="docker compose exec -T db psql -U majlis -d majlis -q -v ON_ERROR_STOP=1"

# Neon's immutable_unaccent() calls unaccent() without a schema name, which
# breaks during restore (pg_restore empties search_path). Create a fixed
# version first and skip the dump's copy of it.
$PSQL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE EXTENSION IF NOT EXISTS unaccent;
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE FUNCTION public.immutable_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
    AS \$\$ SELECT public.unaccent('public.unaccent'::regdictionary, \$1) \$\$;"

docker compose cp "$DUMP" db:/tmp/neon.dump
docker compose exec -T db sh -c '
  pg_restore -l /tmp/neon.dump | grep -v -E "FUNCTION public immutable_unaccent|EXTENSION " > /tmp/neon.list
  pg_restore -U majlis -d majlis --no-owner --no-acl -L /tmp/neon.list /tmp/neon.dump
  rc=$?
  rm -f /tmp/neon.dump /tmp/neon.list
  exit $rc' || echo "     (pg_restore reported problems — check the counts below)"

echo "3/3  Checking..."
docker compose exec -T db psql -U majlis -d majlis -c "
  SELECT 'books' AS table_name, count(*) FROM books
  UNION ALL SELECT 'authors', count(*) FROM authors
  UNION ALL SELECT 'publishers', count(*) FROM publishers
  UNION ALL SELECT 'categories', count(*) FROM categories
  UNION ALL SELECT 'staff', count(*) FROM staff;"

echo "Done. Compare these counts with the live site, then run:"
echo "  docker compose exec app node scripts/migrate-covers.mjs"
