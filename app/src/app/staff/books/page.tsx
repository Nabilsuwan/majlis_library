export const dynamic = "force-dynamic";

import { pool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { findOrCreateAuthor, findOrCreatePublisher, slugify } from "@/lib/staff-helpers";
import { randomUUID } from "crypto";
import DeleteBookButton from "@/components/DeleteBookButton";
import { BookIcon, UsersIcon, BuildingIcon, CameraIcon, HomeIcon, LogoutIcon, EditIcon, FeatherIcon, PlusIcon } from "@/lib/icons";

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
  const proofreaderName = (formData.get("proofreader") as string)?.trim();
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
    `INSERT INTO books (id, title, slug, publisher_id, category_id, quantity, status, proofreader_name)
     VALUES ($1, $2, $3, $4, $5, $6, 'published', $7)
     RETURNING id`,
    [bookId, title, slug, publisherId, categoryId, quantity, proofreaderName || null]
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
  await pool.query(
    "UPDATE intake_submissions SET resulting_book_id = NULL WHERE resulting_book_id = $1",
    [id]
  );
  await pool.query("DELETE FROM book_authors WHERE book_id = $1", [id]);
  await pool.query("DELETE FROM books WHERE id = $1", [id]);
  revalidatePath("/staff/books");
  revalidatePath("/books");
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
      {navLink("/staff/books", true, <BookIcon />, "الكتب")}
      {navLink("/staff/authors", false, <UsersIcon />, "المؤلفون")}
      {navLink("/staff/publishers", false, <BuildingIcon />, "الناشرون")}
      <span style={{ flex: 1, minWidth: 8 }} />
      {navLink("/", false, <HomeIcon />, "الرئيسية")}
      {navLink("/staff/logout", false, <LogoutIcon />, "خروج")}
    </nav>
  );
}

export default async function StaffBooksPage() {
  const [books, categories] = await Promise.all([getBooks(), getCategories()]);

  return (
    <main style={{ padding: "1.25rem", fontFamily: "sans-serif", maxWidth: 900, margin: "0 auto", backgroundColor: "#EDE3D0", minHeight: "100vh" }}>
      <StaffNav />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>إدارة الكتب</h1>
      </div>

      <section style={{ margin: "0 0 1.5rem", padding: "1.25rem", backgroundColor: "#F6F0E2", borderRadius: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>إضافة كتاب جديد</h2>
          <a href="/staff/intake" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#9B2226", textDecoration: "none" }}>
            <CameraIcon size={16} />
            تصوير
          </a>
        </div>
        <form action={addBook} style={{ display: "grid", gap: "0.85rem" }}>
          <label style={{ fontSize: 13 }}>
            العنوان *
            <input name="title" required style={{ width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box" }} />
          </label>
          <label style={{ fontSize: 13 }}>
            المؤلف *
            <input name="author" required style={{ width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box" }} />
          </label>
          <label style={{ fontSize: 13 }}>
            الناشر
            <input name="publisher" style={{ width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box" }} />
          </label>
          <label style={{ fontSize: 13 }}>
            المحقق
            <input name="proofreader" style={{ width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box" }} />
          </label>
          <label style={{ fontSize: 13 }}>
            التصنيف *
            <select name="category_id" required style={{ width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box" }}>
              <option value="">— اختر —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 13 }}>
            الكمية
            <input name="quantity" type="number" defaultValue={1} min={1} style={{ width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box" }} />
          </label>
          <button
            type="submit"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 20px",
              backgroundColor: "#9B2226",
              color: "#EDE3D0",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            <PlusIcon />
            حفظ
          </button>
        </form>
      </section>

      <section>
        <h2 style={{ fontSize: 16 }}>الكتب الحالية ({books.length})</h2>
        {books.length === 0 ? (
          <p style={{ color: "#8C7A5E" }}>لا توجد كتب بعد.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {books.map((b) => (
              <div key={b.id} style={{ backgroundColor: "#F6F0E2", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{b.title}</div>
                  {b.category_name && (
                    <span style={{ backgroundColor: "#9B2226", color: "#F6E9E9", fontSize: 11, padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
                      {b.category_name}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 13, color: "#5C5040" }}>
                  <FeatherIcon />
                  {b.authors || "—"}
                </div>
                {b.publisher_name && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, fontSize: 13, color: "#5C5040" }}>
                    <BuildingIcon size={14} />
                    {b.publisher_name}
                  </div>
                )}
                <div style={{ marginTop: 2, fontSize: 13, color: "#5C5040" }}>الكمية: {b.quantity}</div>
                <div style={{ display: "flex", gap: 16, marginTop: 10, paddingTop: 10, borderTop: "0.5px solid #C9BFA8" }}>
                  <a href={`/staff/books/${b.id}/edit`} style={{ display: "flex", alignItems: "center", gap: 4, color: "#1C1712", fontSize: 13, textDecoration: "none" }}>
                    <EditIcon />
                    تعديل
                  </a>
                  <DeleteBookButton bookId={b.id} deleteAction={deleteBook} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
