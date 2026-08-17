export const dynamic = "force-dynamic";

import { pool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { BookIcon, UsersIcon, BuildingIcon, CameraIcon, HomeIcon, LogoutIcon } from "@/lib/icons";

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

function navLink(href: string, active: boolean, icon: React.ReactNode, label: string) {
  return (
    
    <a
      href={href}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: "8px 10px",
        borderRadius: 6,
        backgroundColor: active ? "#9B2226" : "transparent",
        color: active ? "#EDE3D0" : "#C9BFA8",
        textDecoration: "none",
        minWidth: 56,
        flexShrink: 0,
        fontSize: 11,
      }}
    >
      {icon}
      {label}
    </a>
  );
}

function StaffNav() {
  return (
    <nav
      style={{
        display: "flex",
        gap: 4,
        marginBottom: "1.5rem",
        backgroundColor: "#1C1712",
        borderRadius: 8,
        padding: 6,
        overflowX: "auto",
      }}
    >
      {navLink("/staff/books", false, <BookIcon />, "الكتب")}
      {navLink("/staff/authors", true, <UsersIcon />, "المؤلفون")}
      {navLink("/staff/publishers", false, <BuildingIcon />, "الناشرون")}
      {navLink("/staff/intake", false, <CameraIcon />, "تصوير")}
      <span style={{ flex: 1, minWidth: 8 }} />
      {navLink("/", false, <HomeIcon />, "الرئيسية")}
      {navLink("/staff/logout", false, <LogoutIcon />, "خروج")}
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
    <main style={{ padding: "1.25rem", fontFamily: "sans-serif", maxWidth: 900, margin: "0 auto", backgroundColor: "#EDE3D0", minHeight: "100vh" }}>
      <StaffNav />
      <h1 style={{ fontSize: 20 }}>إدارة المؤلفين</h1>

      <section style={{ margin: "0 0 1.5rem", padding: "1.25rem", backgroundColor: "#F6F0E2", borderRadius: 10 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>دمج مؤلفَين مكررَين</h2>
        <p style={{ color: "#5C5040", fontSize: 13 }}>
          اختر السجل المكرر (سيُحذف) والسجل الذي يجب الاحتفاظ به.
        </p>
        <form action={mergeAuthors} style={{ display: "grid", gap: "0.75rem" }}>
          <label style={{ fontSize: 13 }}>
            السجل المكرر (سيُحذف)
            <select name="from_id" required style={{ display: "block", width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box" }}>
              <option value="">— اختر —</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.canonical_name} ({a.book_count})
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 13 }}>
            السجل المحتفَظ به
            <select name="into_id" required style={{ display: "block", width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box" }}>
              <option value="">— اختر —</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.canonical_name} ({a.book_count})
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            style={{ padding: "10px 20px", backgroundColor: "#9B2226", color: "#EDE3D0", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14 }}
          >
            دمج
          </button>
        </form>
      </section>

      <section>
        <h2 style={{ fontSize: 16 }}>جميع المؤلفين ({authors.length})</h2>
        {duplicateNames.size > 0 && (
          <p style={{ color: "#9B2226", fontSize: 13 }}>
            تنبيه: هناك {duplicateNames.size} اسم مؤلف مكرر أدناه (مظلل) — يُنصح بدمجها.
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {authors.map((a) => {
            const isDup = duplicateNames.has(a.canonical_name.trim().toLowerCase());
            return (
              <div
                key={a.id}
                style={{
                  backgroundColor: isDup ? "#F5DCDC" : "#F6F0E2",
                  borderRadius: 10,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <form action={renameAuthor} style={{ display: "flex", gap: 8, flex: 1 }}>
                  <input type="hidden" name="id" value={a.id} />
                  <input name="name" defaultValue={a.canonical_name} style={{ padding: 6, flex: 1, fontSize: 14 }} />
                  <button type="submit" style={{ fontSize: 12, cursor: "pointer" }}>حفظ</button>
                </form>
                <span style={{ fontSize: 12, color: "#8C7A5E", whiteSpace: "nowrap" }}>{a.book_count} كتاب</span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
