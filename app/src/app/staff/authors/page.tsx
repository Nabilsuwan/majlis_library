import { pool } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function getAuthors() {
  const { rows } = await pool.query(`
    SELECT a.id, a.canonical_name, COUNT(ba.book_id) AS book_count
    FROM authors a
    LEFT JOIN book_authors ba ON ba.author_id = a.id
    GROUP BY a.id
    ORDER BY a.canonical_name
  `);
  return rows;
}

async function renameAuthor(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!id || !name) throw new Error("الاسم مطلوب");
  await pool.query(
    "UPDATE authors SET canonical_name = $1, updated_at = now() WHERE id = $2",
    [name, id]
  );
  revalidatePath("/staff/authors");
}

// Merges one author record into another: every book credited to the
// duplicate gets repointed to the canonical author, the merge is
// logged (author_merge_log), and the duplicate record is removed.
// This is the direct fix for the audit finding of 14 duplicate author
// names (one with 7 separate records).
async function mergeAuthors(formData: FormData) {
  "use server";
  const fromId = formData.get("from_id") as string;
  const intoId = formData.get("into_id") as string;

  if (!fromId || !intoId || fromId === intoId) {
    throw new Error("اختر مؤلفَين مختلفَين لدمجهما");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Avoid a primary-key collision: if a book is already linked to
    // both the duplicate and the canonical author in the same role,
    // drop the duplicate's link before repointing the rest.
    await client.query(
      `DELETE FROM book_authors ba_dup
       WHERE ba_dup.author_id = $1
       AND EXISTS (
         SELECT 1 FROM book_authors ba_keep
         WHERE ba_keep.book_id = ba_dup.book_id
         AND ba_keep.role = ba_dup.role
         AND ba_keep.author_id = $2
       )`,
      [fromId, intoId]
    );

    await client.query(
      "UPDATE book_authors SET author_id = $2 WHERE author_id = $1",
      [fromId, intoId]
    );

    const nameResult = await client.query(
      "SELECT canonical_name FROM authors WHERE id = $1",
      [fromId]
    );

    await client.query(
      `INSERT INTO author_merge_log (merged_from_id, merged_into_id, merged_from_name)
       VALUES ($1, $2, $3)`,
      [fromId, intoId, nameResult.rows[0]?.canonical_name || ""]
    );

    await client.query("DELETE FROM authors WHERE id = $1", [fromId]);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  revalidatePath("/staff/authors");
}
