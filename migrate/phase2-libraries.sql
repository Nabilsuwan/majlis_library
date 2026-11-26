-- Phase 2: a second collection, the Sheikh Library (مكتبة الشيخ).
-- Majlis books keep their numbers (1, 2, 3…); Sheikh books get their own
-- series, shown as S-1, S-2…  Safe to run more than once:
--   docker compose exec -T db psql -U majlis -d majlis -v ON_ERROR_STOP=1 < migrate/phase2-libraries.sql

BEGIN;

ALTER TABLE books ADD COLUMN IF NOT EXISTS library TEXT NOT NULL DEFAULT 'majlis';
DO $$ BEGIN
  ALTER TABLE books ADD CONSTRAINT books_library_check CHECK (library IN ('majlis', 'sheikh'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_books_library ON books (library);

-- Numbers are unique within each library, not across both.
CREATE SEQUENCE IF NOT EXISTS books_sheikh_number_seq;
DROP INDEX IF EXISTS books_book_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS books_library_number_key ON books (library, book_number);

-- The next number comes from the book's own library series.
ALTER TABLE books ALTER COLUMN book_number DROP DEFAULT;
CREATE OR REPLACE FUNCTION assign_book_number() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.book_number IS NULL THEN
    NEW.book_number := CASE NEW.library
      WHEN 'sheikh' THEN nextval('books_sheikh_number_seq')
      ELSE nextval('books_book_number_seq')
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assign_book_number ON books;
CREATE TRIGGER trg_assign_book_number
BEFORE INSERT ON books
FOR EACH ROW EXECUTE FUNCTION assign_book_number();

COMMIT;

SELECT library, count(*) AS books, min(book_number) AS first_no, max(book_number) AS last_no
FROM books GROUP BY library ORDER BY library;
