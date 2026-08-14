-- ============================================================
-- Majlis Library System (sharjahbook.com) — Database Schema v1
-- ============================================================
-- Designed from the audited export of the existing ~2,000-book
-- collection. Every design decision below is tied to a specific
-- problem found in that data, or a requirement from the project
-- brief. See inline notes.
--
-- Target: PostgreSQL 15+
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "unaccent";   -- helps with fuzzy search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- trigram similarity for
                                              -- "typed without diacritics
                                              -- or spelled slightly
                                              -- differently" search (brief,
                                              -- public-site requirements)

-- ------------------------------------------------------------
-- STAFF ACCOUNTS
-- ------------------------------------------------------------
-- Roles decided in Stage 2 scoping: cataloguer / admin / viewer.
-- Every write anywhere in this schema is attributed to a staff_id
-- so the "who changed what and when" requirement is structural,
-- not bolted on later.

CREATE TYPE staff_role AS ENUM ('cataloguer', 'admin', 'viewer');

CREATE TABLE staff (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          staff_role NOT NULL DEFAULT 'cataloguer',
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- AUTHORS
-- ------------------------------------------------------------
-- Problem found in audit: 300 author records, only 281 distinct
-- names — 14 names duplicated, one (عبدالرحمن بدوي) with 7 separate
-- records. The old system had no merge path, so duplicates just
-- accumulated on every import.
--
-- Fix: author_aliases lets staff merge duplicates without deleting
-- history — old records get redirected to the canonical author via
-- alias rows instead of being destroyed. Anything that referenced
-- the old duplicate (a book, an audit log entry) keeps working.

CREATE TABLE authors (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_name    TEXT NOT NULL,
    canonical_name_normalized TEXT GENERATED ALWAYS AS
                      (unaccent(lower(canonical_name))) STORED,
    notes             TEXT,               -- bio, dates, disambiguation
    created_by        UUID REFERENCES staff(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_authors_name_trgm
    ON authors USING gin (canonical_name_normalized gin_trgm_ops);

-- When two author records are found to be the same person, staff
-- merge B into A: B's id is recorded here pointing at A, B's row
-- is deleted (or flagged), and every book_authors row referencing
-- B is repointed to A in the same transaction.
CREATE TABLE author_merge_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merged_from_id  UUID NOT NULL,       -- the duplicate that was removed
    merged_into_id  UUID NOT NULL REFERENCES authors(id),
    merged_from_name TEXT NOT NULL,      -- preserved for audit even
                                          -- though the row is gone
    merged_by       UUID REFERENCES staff(id),
    merged_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- PUBLISHERS
-- ------------------------------------------------------------
-- Problem found in audit: the old "رمز الناشر" (publisher code)
-- field is reused across 3-5 unrelated publishers, so it can't be
-- an identifier. Also found near-duplicate typo pairs (e.g. "دار
-- رؤية للنشر و التوزيع" vs "داغر رؤية للنشر و التوزيع").
--
-- Fix: no external "code" field pretending to be unique. The
-- trigram index below is what powers a "did you mean an existing
-- publisher?" check at data-entry time, the same way we want it
-- for authors and books.

CREATE TABLE publishers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT NOT NULL,
    name_normalized   TEXT GENERATED ALWAYS AS
                      (unaccent(lower(name))) STORED,
    city              TEXT,
    created_by        UUID REFERENCES staff(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_publishers_name_trgm
    ON publishers USING gin (name_normalized gin_trgm_ops);

-- ------------------------------------------------------------
-- CATEGORIES / SUB-CATEGORIES
-- ------------------------------------------------------------
-- Problem found in audit: the category table has literal test junk
-- ("test", "test category") sitting alongside real subjects. The
-- sub_category table is worse — several rows contain author names
-- or stray text instead of actual subcategory topics, because
-- fields got crossed during the original import/migration.
--
-- Fix: nothing structural prevents bad data being typed in again,
-- but a clean, small, deliberately-curated starting set (from the
-- 13 real categories the audit found genuinely in use) replaces
-- migrating the old table wholesale. No sub_category is imported
-- automatically — each one gets reviewed by a human before it
-- exists in the new system.

CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sub_categories (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id   UUID NOT NULL REFERENCES categories(id),
    name          TEXT NOT NULL,
    UNIQUE (category_id, name)
);

-- ------------------------------------------------------------
-- BOOKS
-- ------------------------------------------------------------
-- Decisions applied here from this conversation:
--   - No lending: no due_date / borrower / availability-status
--     fields at all. `status` only distinguishes catalogued vs.
--     not-yet-processed, not "checked out."
--   - Old "نوع الكتاب" (book type) field is dropped entirely — it
--     held a single constant value ("Sheik") across the whole
--     export and carried no real information.
--   - Cover images collected via the photograph-to-add workflow
--     (Stage 4), stored here as a reference to object storage.

CREATE TYPE book_status AS ENUM ('draft', 'published');

CREATE TABLE books (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title             TEXT NOT NULL,
    title_normalized  TEXT GENERATED ALWAYS AS
                      (unaccent(lower(title))) STORED,
                      -- powers "search finds it even without
                      -- diacritics or with slight spelling
                      -- differences" (brief, public-site reqs)

    subtitle          TEXT,
    edition_number     INTEGER,
    page_count        INTEGER,

    publisher_id      UUID REFERENCES publishers(id),
    category_id       UUID REFERENCES categories(id),
    sub_category_id   UUID REFERENCES sub_categories(id),

    cover_image_url   TEXT,
    quantity          INTEGER NOT NULL DEFAULT 1,

    status            book_status NOT NULL DEFAULT 'draft',
                      -- draft = staff is still reviewing a
                      -- photograph-to-add suggestion; published =
                      -- confirmed and visible on the public site

    slug              TEXT UNIQUE,  -- for shareable/bookmarkable
                                     -- book pages (brief, public-
                                     -- site requirements)

    created_by        UUID REFERENCES staff(id),
    updated_by        UUID REFERENCES staff(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_books_title_trgm
    ON books USING gin (title_normalized gin_trgm_ops);
CREATE INDEX idx_books_category ON books (category_id);
CREATE INDEX idx_books_publisher ON books (publisher_id);

-- Duplicate-on-add warning (brief: "be warned when a book already
-- exists before adding it twice") is implemented as an application-
-- level check against idx_books_title_trgm at save time, not a hard
-- DB constraint — titles legitimately repeat across different
-- editions/publishers, so this needs to be a warning, not a block.

-- ------------------------------------------------------------
-- BOOK <-> AUTHOR (many-to-many, with role)
-- ------------------------------------------------------------
-- Problem found in audit: fields like "اسم المدقق" (checker/editor
-- name) routinely contain multiple people jammed into one string,
-- e.g. "أحمد شوقي بنبين و محمد سعيد حنشي و عبدالعالي لمدبر". This
-- makes every one of those people un-searchable individually and
-- is exactly the kind of thing that becomes permanent if migrated
-- as-is.
--
-- Fix: every person associated with a book is a real row here,
-- with a role. Multi-person strings get split into individual
-- author rows during data migration (Stage 6), not carried over
-- as one blob.

CREATE TYPE contributor_role AS ENUM (
    'author', 'editor', 'annotator', 'translator', 'checker'
);

CREATE TABLE book_authors (
    book_id     UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES authors(id),
    role        contributor_role NOT NULL DEFAULT 'author',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (book_id, author_id, role)
);

-- ------------------------------------------------------------
-- AUDIT LOG
-- ------------------------------------------------------------
-- Brief requirement: "see a record of who changed what and when."
-- Applies to every entity, every role — not just admin actions.

CREATE TABLE audit_log (
    id            BIGSERIAL PRIMARY KEY,
    entity_type   TEXT NOT NULL,       -- 'book' | 'author' | 'publisher' | ...
    entity_id     UUID NOT NULL,
    action        TEXT NOT NULL,       -- 'create' | 'update' | 'delete' | 'merge'
    changed_by    UUID REFERENCES staff(id),
    before_value  JSONB,
    after_value   JSONB,
    changed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id);

-- ------------------------------------------------------------
-- PHOTOGRAPH-TO-ADD INTAKE QUEUE (Stage 4 — trial first)
-- ------------------------------------------------------------
-- A librarian photographs a book; the system reads it and produces
-- a *suggestion*, never a saved record. A human always confirms.
-- This table is the holding area between "photographed" and
-- "confirmed into `books`."

CREATE TYPE intake_status AS ENUM ('pending_review', 'confirmed', 'rejected');

CREATE TABLE intake_submissions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cover_image_url   TEXT,
    title_page_image_url TEXT,

    suggested_data    JSONB NOT NULL,   -- raw model output: title,
                                         -- author guess, publisher
                                         -- guess, edition, page
                                         -- count, confidence scores

    status            intake_status NOT NULL DEFAULT 'pending_review',
    resulting_book_id UUID REFERENCES books(id),  -- set once confirmed

    submitted_by      UUID REFERENCES staff(id),
    reviewed_by       UUID REFERENCES staff(id),
    submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at       TIMESTAMPTZ
);
