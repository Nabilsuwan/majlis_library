-- Phase 1: Book IDs, physical copies, shelf boxes.
-- Safe to run more than once. Run on the NAS from the project folder:
--   docker compose exec -T db psql -U majlis -d majlis -v ON_ERROR_STOP=1 < migrate/phase1-locations.sql

BEGIN;

-- ------------------------------------------------------------
-- 1. Book ID: a permanent number per title (123), oldest = 1
-- ------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS books_book_number_seq;
ALTER TABLE books ADD COLUMN IF NOT EXISTS book_number INTEGER;

WITH start AS (SELECT COALESCE(max(book_number), 0) AS n FROM books),
     ordered AS (
       SELECT id, row_number() OVER (ORDER BY created_at, id) AS n
       FROM books WHERE book_number IS NULL)
UPDATE books b SET book_number = start.n + ordered.n
FROM ordered, start
WHERE b.id = ordered.id;

SELECT setval('books_book_number_seq',
              COALESCE((SELECT max(book_number) FROM books), 0) + 1, false);
ALTER TABLE books ALTER COLUMN book_number SET DEFAULT nextval('books_book_number_seq');
ALTER SEQUENCE books_book_number_seq OWNED BY books.book_number;
ALTER TABLE books ALTER COLUMN book_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS books_book_number_key ON books (book_number);

-- ------------------------------------------------------------
-- 2. Shelf boxes: level letter from the bottom (A-F) + box number
--    counted from the right, continuous around the room (e.g. C12)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shelf_boxes (
    code       TEXT PRIMARY KEY,
    wall       SMALLINT NOT NULL,
    level      CHAR(1)  NOT NULL CHECK (level IN ('A','B','C','D','E','F')),
    box_no     SMALLINT NOT NULL,
    notes      TEXT,
    tag_uid    TEXT UNIQUE,          -- optional NFC tag on the shelf edge
    is_active  BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (level, box_no)
);

INSERT INTO shelf_boxes (code, wall, level, box_no)
SELECT r.level || n, r.wall, r.level, n
FROM (VALUES
  (1,'A',1,3),  (1,'B',1,7),  (1,'C',1,6),  (1,'D',1,7),  (1,'E',1,6),  (1,'F',1,7),
  (2,'A',4,7),  (2,'B',8,14), (2,'C',7,15), (2,'D',8,16), (2,'E',7,15), (2,'F',8,16),
  (3,'A',8,11), (3,'B',15,23),(3,'C',16,24),(3,'D',17,25),(3,'E',16,25),(3,'F',17,25)
) AS r(wall, level, first_box, last_box),
LATERAL generate_series(r.first_box, r.last_box) AS n
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------
-- 3. Physical copies: one row per copy (123-1, 123-2), each with
--    its own NFC tag and shelf box
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS book_copies (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id       UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    copy_number   SMALLINT NOT NULL,
    tag_uid       TEXT UNIQUE,
    shelf_code    TEXT REFERENCES shelf_boxes(code),
    status        TEXT NOT NULL DEFAULT 'on_shelf'
                  CHECK (status IN ('on_shelf', 'missing', 'withdrawn')),
    last_seen_at  TIMESTAMPTZ,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (book_id, copy_number)
);
CREATE INDEX IF NOT EXISTS idx_book_copies_shelf ON book_copies (shelf_code);

-- Keep copies in step with books.quantity: new copies are added when the
-- quantity goes up; when it goes down, only extra copies that have no tag
-- and no shelf yet are removed (tagged or placed copies are never deleted).
CREATE OR REPLACE FUNCTION sync_book_copies() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO book_copies (book_id, copy_number)
  SELECT NEW.id, g FROM generate_series(1, GREATEST(NEW.quantity, 1)) AS g
  ON CONFLICT (book_id, copy_number) DO NOTHING;

  DELETE FROM book_copies
  WHERE book_id = NEW.id
    AND copy_number > GREATEST(NEW.quantity, 1)
    AND tag_uid IS NULL AND shelf_code IS NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_book_copies ON books;
CREATE TRIGGER trg_sync_book_copies
AFTER INSERT OR UPDATE OF quantity ON books
FOR EACH ROW EXECUTE FUNCTION sync_book_copies();

INSERT INTO book_copies (book_id, copy_number)
SELECT b.id, g FROM books b, generate_series(1, GREATEST(b.quantity, 1)) AS g
ON CONFLICT (book_id, copy_number) DO NOTHING;

COMMIT;

SELECT (SELECT count(*) FROM books)        AS books,
       (SELECT min(book_number) FROM books) AS first_id,
       (SELECT max(book_number) FROM books) AS last_id,
       (SELECT count(*) FROM book_copies)  AS copies,
       (SELECT count(*) FROM shelf_boxes)  AS shelf_boxes;
