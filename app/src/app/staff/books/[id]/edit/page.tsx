import { pool } from "@/lib/db";
import { redirect } from "next/navigation";
import { findOrCreateAuthor, findOrCreatePublisher } from "@/lib/staff-helpers";

async function getBook(id: string) {
  const { rows } = await pool.query(
    `
    SELECT b.id, b.title, b.quantity, b.category_id,
           p.name AS publisher_name,
           COALESCE(
             (SELECT a.canonical_name FROM book_authors ba
              JOIN authors a ON a.id = ba.author_id
              WHERE ba.book_id = b.id AND ba.role = 'author'
              ORDER BY ba.sort_order LIMIT 1),
             ''
           ) AS author_name
    FROM books b
    LEFT JOIN publishers p ON p.id = b.publisher_id
    WHERE b.id = $1
    `,
    [id]
  );
  return rows[0] || null;
}

async function getCategories() {
  const { rows } = await pool.query(
    "SELECT id, name FROM categories ORDER BY sort_order"
  );
  return rows;
}

async function updateBook(formData: FormData) {
  "use server";

  const id = formData.get("id") as string;
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

  await pool.query(
    `UPDATE books SET title = $1, publisher_id = $2, category_id = $3,
     quantity = $4, updated_at = now() WHERE id = $5`,
    [title, publisherId, categoryId, quantity, id]
  );

  // Replace the primary author link with whatever was typed in the form.
  await pool.query(
    "DELETE FROM book_authors WHERE book_id = $1 AND role = 'author'",
    [id]
  );
  await pool.query(
    `INSERT INTO book_authors (book_id, author_id, role, sort_order)
     VALUES ($1, $2, 'author', 0)`,
    [id, authorId]
  );

  redirect("/staff/books");
}

export default async function EditBookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [book, categories] = await Promise.all([getBook(id), getCategories()]);

  if (!book) {
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p>الكتاب غير موجود.</p>
        <a href="/staff/books">العودة إلى قائمة الكتب</a>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 500, margin: "0 auto" }}>
      <h1>تعديل كتاب</h1>
      <form action={updateBook} style={{ display: "grid", gap: "1rem" }}>
        <input type="hidden" name="id" value={book.id} />
        <label>
          العنوان *
          <input name="title" defaultValue={book.title} required style={{ width: "100%", padding: 8 }} />
        </label>
        <label>
          المؤلف *
          <input name="author" defaultValue={book.author_name} required style={{ width: "100%", padding: 8 }} />
        </label>
        <label>
          الناشر
          <input name="publisher" defaultValue={book.publisher_name || ""} style={{ width: "100%", padding: 8 }} />
        </label>
        <label>
          التصنيف *
          <select name="category_id" defaultValue={book.category_id || ""} required style={{ width: "100%", padding: 8 }}>
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
          <input name="quantity" type="number" defaultValue={book.quantity} min={1} style={{ width: "100%", padding: 8 }} />
        </label>
        <button type="submit" style={{ padding: "10px 20px", cursor: "pointer" }}>
          حفظ التعديلات
        </button>
      </form>
      <p style={{ marginTop: "1rem" }}>
        <a href="/staff/books">إلغاء والعودة</a>
      </p>
    </main>
  );
}
