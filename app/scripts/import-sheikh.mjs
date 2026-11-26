// Imports the Sheikh Library (مكتبة الشيخ) list: the 192 "Sheik" rows of
// sheik__privite_library_db.xlsx, cleaned into data/sheikh-books.json.
//
//   docker compose exec app node scripts/import-sheikh.mjs           (check only, saves nothing)
//   docker compose exec app node scripts/import-sheikh.mjs --apply   (saves)
//
// Safe to re-run: a title already in the Sheikh Library is skipped.
// Authors, publishers and categories that already exist are reused.
import pg from "pg";
import { readFile } from "fs/promises";
import { randomUUID } from "crypto";

const apply = process.argv.includes("--apply");
const books = JSON.parse(await readFile(new URL("./data/sheikh-books.json", import.meta.url), "utf8"));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = await pool.connect();
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

const stats = {
  rows: books.length, added: 0, copies: 0, skippedAlreadyImported: 0, alsoInMajlis: 0,
  newAuthors: new Set(), newPublishers: new Set(), newCategories: new Set(),
};
const majlisTwins = [];

try {
  await db.query("BEGIN");
  const col = await db.query(
    "SELECT 1 FROM information_schema.columns WHERE table_name = 'books' AND column_name = 'library'"
  );
  if (!col.rowCount) throw new Error("Run migrate/phase2-libraries.sql first.");

  // Numbers are given here (S-1, S-2… in file order), not drawn from the
  // sequence, so a check-only run never uses any up.
  let nextNumber = Number((await db.query(
    "SELECT COALESCE(max(book_number), 0) AS n FROM books WHERE library = 'sheikh'"
  )).rows[0].n) + 1;

  const categories = new Map(
    (await db.query("SELECT id, name FROM categories")).rows.map((r) => [norm(r.name), r.id])
  );

  async function findOrCreate(table, column, name, created) {
    const found = await db.query(
      `SELECT id FROM ${table} WHERE ${column}_normalized = immutable_unaccent(lower($1)) LIMIT 1`,
      [name]
    );
    if (found.rows[0]) return found.rows[0].id;
    created.add(name);
    return (await db.query(`INSERT INTO ${table} (${column}) VALUES ($1) RETURNING id`, [name])).rows[0].id;
  }

  for (const b of books) {
    const title = norm(b.title);
    const same = `SELECT id, book_number FROM books
                  WHERE library = $1 AND title_normalized = immutable_unaccent(lower($2)) LIMIT 1`;
    if ((await db.query(same, ["sheikh", title])).rowCount) {
      stats.skippedAlreadyImported++;
      continue;
    }
    const twin = await db.query(same, ["majlis", title]);
    if (twin.rowCount) {
      stats.alsoInMajlis++;
      if (majlisTwins.length < 10) majlisTwins.push(`${title}  (Majlis #${twin.rows[0].book_number})`);
    }

    const catName = norm(b.category);
    let categoryId = categories.get(catName);
    if (!categoryId && catName) {
      categoryId = (await db.query(
        `INSERT INTO categories (name, sort_order)
         VALUES ($1, (SELECT COALESCE(max(sort_order), 0) + 1 FROM categories)) RETURNING id`,
        [catName]
      )).rows[0].id;
      categories.set(catName, categoryId);
      stats.newCategories.add(catName);
    }
    const authorId = b.author ? await findOrCreate("authors", "canonical_name", norm(b.author), stats.newAuthors) : null;
    const publisherId = b.publisher ? await findOrCreate("publishers", "name", norm(b.publisher), stats.newPublishers) : null;

    const id = randomUUID();
    await db.query(
      `INSERT INTO books (id, title, slug, publisher_id, category_id, quantity, status,
                          proofreader_name, edition_number, page_count, library, book_number)
       VALUES ($1, $2, $3, $4, $5, $6, 'published', $7, $8, $9, 'sheikh', $10)`,
      [id, title, id.replace(/-/g, "").slice(0, 8), publisherId, categoryId, b.quantity || 1,
       norm(b.editor) || null, b.edition_number ?? null, b.pages ?? null, nextNumber++]
    );
    if (authorId) {
      await db.query(
        "INSERT INTO book_authors (book_id, author_id, role, sort_order) VALUES ($1, $2, 'author', 0)",
        [id, authorId]
      );
    }
    stats.added++;
    stats.copies += b.quantity || 1;
  }

  const range = await db.query(
    "SELECT min(book_number) AS a, max(book_number) AS z, count(*) AS n FROM books WHERE library = 'sheikh'"
  );

  console.log(apply ? "=== IMPORT (saved) ===" : "=== CHECK ONLY (nothing saved) ===");
  console.log(`rows in file .................. ${stats.rows}`);
  console.log(`books to add .................. ${stats.added}  (${stats.copies} copies)`);
  console.log(`already in Sheikh, skipped .... ${stats.skippedAlreadyImported}`);
  console.log(`same title also in Majlis ..... ${stats.alsoInMajlis}  (kept as separate records)`);
  console.log(`new authors ................... ${stats.newAuthors.size}`);
  console.log(`new publishers ................ ${stats.newPublishers.size}`);
  console.log(`new categories ................ ${stats.newCategories.size} ${[...stats.newCategories].join("، ")}`);
  if (range.rows[0].n > 0) console.log(`Sheikh numbers ................ S-${range.rows[0].a} to S-${range.rows[0].z}`);
  if (majlisTwins.length) console.log("examples also in Majlis:\n  " + majlisTwins.join("\n  "));

  if (apply) {
    // New Sheikh books added later from the staff pages continue after these.
    await db.query(
      "SELECT setval('books_sheikh_number_seq', (SELECT COALESCE(max(book_number), 0) + 1 FROM books WHERE library = 'sheikh'), false)"
    );
    await db.query("COMMIT");
    console.log("Saved.");
  } else {
    await db.query("ROLLBACK");
    console.log("Nothing was saved. Run again with --apply to import.");
  }
} catch (err) {
  await db.query("ROLLBACK");
  console.error("FAILED, nothing saved:", err.message);
  process.exitCode = 1;
} finally {
  db.release();
  await pool.end();
}
