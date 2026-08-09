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
function StaffNav() {
  return (
    <nav style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", fontSize: 14 }}>
      <a href="/staff/books">الكتب</a>
      <a href="/staff/authors" style={{ fontWeight: "bold" }}>المؤلفون</a>
      <a href="/staff/publishers">الناشرون</a>
    </nav>
  );
}

export default async function StaffAuthorsPage() {
  const authors = await getAuthors();
  const duplicateNames = new Set(
    authors
      .map((a) => a.canonical_name.trim().toLowerCase())
      .filter((name, i, arr) => arr.indexOf(name) !== i)
  );

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <StaffNav />
      <h1>إدارة المؤلفين</h1>

      <section style={{ margin: "2rem 0", padding: "1.5rem", border: "1px solid #ddd", borderRadius: 8 }}>
        <h2>دمج مؤلفَين مكررَين</h2>
        <p style={{ color: "#666", fontSize: 14 }}>
          اختر السجل المكرر (سيُحذف) والسجل الذي يجب الاحتفاظ به. سيتم نقل جميع الكتب إلى السجل المحتفَظ به.
        </p>
        <form action={mergeAuthors} style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <label>
            السجل المكرر (سيُحذف)
            <select name="from_id" required style={{ display: "block", padding: 8, minWidth: 220 }}>
              <option value="">— اختر —</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.canonical_name} ({a.book_count})
                </option>
              ))}
            </select>
          </label>
          <label>
            السجل المحتفَظ به
            <select name="into_id" required style={{ display: "block", padding: 8, minWidth: 220 }}>
              <option value="">— اختر —</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.canonical_name} ({a.book_count})
                </option>
              ))}
            </select>
          </label>
          <button type="submit" style={{ padding: "10px 20px", cursor: "pointer" }}>
            دمج
          </button>
        </form>
      </section>

      <section>
        <h2>جميع المؤلفين ({authors.length})</h2>
        {duplicateNames.size > 0 && (
          <p style={{ color: "#b00", fontSize: 14 }}>
            تنبيه: هناك {duplicateNames.size} اسم مؤلف مكرر أدناه (مظلل) — يُنصح بدمجها.
          </p>
        )}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #ddd", textAlign: "right" }}>
              <th style={{ padding: 8 }}>الاسم</th>
              <th style={{ padding: 8 }}>عدد الكتب</th>
              <th style={{ padding: 8 }}></th>
            </tr>
          </thead>
          <tbody>
            {authors.map((a) => {
              const isDup = duplicateNames.has(a.canonical_name.trim().toLowerCase());
              return (
                <tr
                  key={a.id}
                  style={{
                    borderBottom: "1px solid #eee",
                    background: isDup ? "#fff3f3" : "transparent",
                  }}
                >
                  <td style={{ padding: 8 }}>
                    <form action={renameAuthor} style={{ display: "flex", gap: 8 }}>
                      <input type="hidden" name="id" value={a.id} />
                      <input name="name" defaultValue={a.canonical_name} style={{ padding: 6, flex: 1 }} />
                      <button type="submit" style={{ cursor: "pointer" }}>حفظ</button>
                    </form>
                  </td>
                  <td style={{ padding: 8 }}>{a.book_count}</td>
                  <td style={{ padding: 8 }}></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
