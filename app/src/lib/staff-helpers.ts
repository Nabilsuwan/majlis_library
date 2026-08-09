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
