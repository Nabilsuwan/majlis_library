import { pool } from "@/lib/db";

// Finds an existing row by case-insensitive exact name match, or
// creates a new one. Exact-match only for now — fuzzy "did you
// mean...?" matching (using the trigram indexes already in the
// schema) is a natural next improvement.
export async function findOrCreateAuthor(name: string): Promise<string> {
  const existing = await pool.query(
    "SELECT id FROM authors WHERE lower(canonical_name) = lower($1) LIMIT 1",
    [name]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const created = await pool.query(
    "INSERT INTO authors (canonical_name) VALUES ($1) RETURNING id",
    [name]
  );
  return created.rows[0].id;
}

export async function findOrCreatePublisher(name: string): Promise<string> {
  const existing = await pool.query(
    "SELECT id FROM publishers WHERE lower(name) = lower($1) LIMIT 1",
    [name]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const created = await pool.query(
    "INSERT INTO publishers (name) VALUES ($1) RETURNING id",
    [name]
  );
  return created.rows[0].id;
}

// Builds a URL-friendly slug from a book title plus a short chunk of
// its id, so the public book page has a stable, shareable, readable
// address (e.g. /books/تاريخ-الطبري-a1b2c3d4) instead of a bare UUID.
// Arabic characters are kept as-is — modern browsers and search
// engines handle non-Latin URLs natively.
export function slugify(title: string, id: string): string {
  const base = title
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, "") // strip Arabic diacritics
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .toLowerCase();
  const suffix = id.replace(/-/g, "").slice(0, 8);
  return `${base}-${suffix}`;
}
