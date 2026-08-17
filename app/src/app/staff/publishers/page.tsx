export const dynamic = "force-dynamic";

import { pool } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function getPublishers() {
  const { rows } = await pool.query(`
    SELECT p.id, p.name, COUNT(b.id) AS book_count
    FROM publishers p
    LEFT JOIN books b ON b.publisher_id = p.id
    GROUP BY p.id
    ORDER BY p.name
  `);
  return rows;
}

async function renamePublisher(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!id || !name) throw new Error("الاسم مطلوب");
  await pool.query("UPDATE publishers SET name = $1 WHERE id = $2", [name, id]);
  revalidatePath("/staff/publishers");
}

function StaffNav() {
  return (
    <nav style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", fontSize: 14, alignItems: "center" }}>
      <a href="/staff/books">الكتب</a>
      <a href="/staff/authors">المؤلفون</a>
      <a href="/staff/publishers" style={{ fontWeight: "bold" }}>الناشرون</a>
      <span style={{ flex: 1 }} />
      <a href="/">الرئيسية</a>
      <a href="/staff/logout">تسجيل خروج</a>
    </nav>
  );
}

export default async function StaffPublishersPage() {
  const publishers = await getPublishers();

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <StaffNav />
      <h1>إدارة الناشرين</h1>

      <section>
        <h2>جميع الناشرين ({publishers.length})</h2>
        {publishers.length === 0 ? (
          <p style={{ color: "#666" }}>لا يوجد ناشرون بعد.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd", textAlign: "right" }}>
                <th style={{ padding: 8 }}>الاسم</th>
                <th style={{ padding: 8 }}>عدد الكتب</th>
              </tr>
            </thead>
            <tbody>
              {publishers.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>
                    <form action={renamePublisher} style={{ display: "flex", gap: 8 }}>
                      <input type="hidden" name="id" value={p.id} />
                      <input name="name" defaultValue={p.name} style={{ padding: 6, flex: 1 }} />
                      <button type="submit" style={{ cursor: "pointer" }}>حفظ</button>
                    </form>
                  </td>
                  <td style={{ padding: 8 }}>{p.book_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </main>
  );
}
