-- Extra book details kept from the Sheikh Library catalogue.
-- Safe to run more than once:
--   docker compose exec -T db psql -U majlis -d majlis -v ON_ERROR_STOP=1 < migrate/phase2b-book-details.sql
BEGIN;
ALTER TABLE books ADD COLUMN IF NOT EXISTS edition_text TEXT;   -- e.g. "الأولى 1416-1995"
ALTER TABLE books ADD COLUMN IF NOT EXISTS volumes SMALLINT;    -- number of volumes (مجلدات)
ALTER TABLE books ADD COLUMN IF NOT EXISTS notes TEXT;          -- staff notes: gift, condition…
ALTER TABLE books ADD COLUMN IF NOT EXISTS import_ref TEXT;     -- source row, so an import can re-run safely
CREATE UNIQUE INDEX IF NOT EXISTS books_import_ref_key ON books (import_ref);
COMMIT;
