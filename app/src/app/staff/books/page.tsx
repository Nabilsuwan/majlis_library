export const dynamic = "force-dynamic";

import { pool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { findOrCreateAuthor, findOrCreatePublisher, slugify } from "@/lib/staff-helpers";
import { randomUUID } from "crypto";

async function getBooks() {
  const { rows } = await pool.query(`
    SELECT b.id, b.title, b.quantity, b.status,
           p.name AS publisher_name,
           c.name AS category_name,
           COALESCE(
             string_agg(a.canonical_name, '، ' ORDER BY ba.sort_order),
             ''
           ) AS authors
    FROM books b
    LEFT JOIN publishers p ON p.id = b.publisher_id
    LEFT JOIN categories c ON c.id = b.category_id
    LEFT JOIN book_authors ba ON ba.book_id = b.id AND ba.role = 'author'
    LEFT JOIN authors a ON a.id = ba.author_id
    GROUP BY b.id, p.name, c.name
    ORDER BY b.created_at DESC
  `);
  return rows;
}

async function getCategories() {
  const { rows } = await pool.query(
    "SELECT id, name FROM categories ORDER BY sort_order"
  );
  return rows;
}

async function addBook(formData: FormData) {
  "use server";

  const title = (formData.get("title") as string)?.trim();
  const authorName = (formData.get("author") as string)?.trim();
  const publisherName = (formData.get("publisher") as string)?.trim();
  const categoryId = formData.get("category_id") as string;
  const quantity = Number(formData.get("quantity")) || 1;

  if (!title || !authorName || !categoryId) {
    throw new Error("العنوان والمؤلف والتصنيف مطلوبة");
  }

  const authorId = await findOrCreateAuthor(authorName);
  const publisherId = publisherName
    ? await findOrCreatePublisher(publisherName)
    : null;

  const bookId = randomUUID();
  const slug = slugify(title, bookId);

  const book = await pool.query(
    `INSERT INTO books (id, title, slug, publisher_id, category_id, quantity, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'published')
     RETURNING id`,
    [bookId, title, slug, publisherId, categoryId, quantity]
  );

  await pool.query(
    `INSERT INTO book_authors (book_id, author_id, role, sort_order)
     VALUES ($1, $2, 'author', 0)`,
    [book.rows[0].id, authorId]
  );

  revalidatePath("/staff/books");
  revalidatePath("/books");
}

async function deleteBook(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  await pool.query("DELETE FROM books WHERE id = $1", [id]);
  revalidatePath("/staff/books");
  revalidatePath("/books");
}

function StaffNav() {
  return (
    <nav style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", fontSize: 14, alignItems: "center" }}>
      <a href="/staff/books" style={{ fontWeight: "bold" }}>الكتب</a>
      <a href="/staff/authors">المؤلفون</a>
      <a href="/staff/publishers">الناشرون</a>
      <span style={{ flex: 1 }} />
      <a href="/">الرئيسية</a>
      <a href="/staff/logout">تسجيل خروج</a>
    </nav>
  );
}

export default async function StaffBooksPage() {
  const [books, categories] = await Promise.all([getBooks(), getCategories()]);

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <StaffNav />
      <h1>إدارة الكتب</h1>
      <p style={{ color: "#666" }}>
        صفحة تجريبية لإضافة الكتب — بدون تسجيل دخول بعد (سيُضاف لاحقًا).
      </p>

      <section style={{ margin: "2rem 0", padding: "1.5rem", border: "1px solid #ddd", borderRadius: 8 }}>
        <h2>إضافة كتاب جديد</h2>
        <form action={addBook} style={{ display: "grid", gap: "1rem", maxWidth: 500 }}>
          <label>
            العنوان *
            <input name="title" required style={{ width: "100%", padding: 8 }} />
          </label>
          <label>
            المؤلف *
            <input name="author" required style={{ width: "100%", padding: 8 }} />
          </label>
          <label>
            الناشر
            <input name="publisher" style={{ width: "100%", padding: 8 }} />
          </label>
          <label>
            التصنيف *
            <select name="category_id" required style={{ width: "100%", padding: 8 }}>
              <option value="">— اختر —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            الكمية
            <input name="quantity" type="number" defaultValue={1} min={1} style={{ width: "100%", padding: 8 }} />
          </label>
          <button type="submit" style={{ padding: "10px 20px", cursor: "pointer" }}>
            حفظ
          </button>
        </form>
      </section>

      <section>
        <h2>الكتب الحالية ({books.length})</h2>
        {books.length === 0 ? (
          <p style={{ color: "#666" }}>لا توجد كتب بعد.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd", textAlign: "right" }}>
                <th style={{ padding: 8 }}>العنوان</th>
                <th style={{ padding: 8 }}>المؤلف</th>
                <th style={{ padding: 8 }}>الناشر</th>
                <th style={{ padding: 8 }}>التصنيف</th>
                <th style={{ padding: 8 }}>الكمية</th>
                <th style={{ padding: 8 }}></th>
                <th style={{ padding: 8 }}></th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>{b.title}</td>
                  <td style={{ padding: 8 }}>{b.authors || "—"}</td>
                  <td style={{ padding: 8 }}>{b.publisher_name || "—"}</td>
                  <td style={{ padding: 8 }}>{b.category_name || "—"}</td>
                  <td style={{ padding: 8 }}>{b.quantity}</td>
                  <td style={{ padding: 8 }}>
                    <a href={`/staff/books/${b.id}/edit`}>تعديل</a>
                  </td>
                  <td style={{ padding: 8 }}>
                    <form action={deleteBook}>
                      <input type="hidden" name="id" value={b.id} />
                      <button type="submit" style={{ color: "#b00", cursor: "pointer" }}>
                        حذف
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
