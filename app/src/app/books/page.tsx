export const dynamic = "force-dynamic";

import { pool } from "@/lib/db";

async function getCategories() {
  const { rows } = await pool.query(
    "SELECT id, name FROM categories ORDER BY sort_order"
  );
  return rows;
}

async function searchBooks(q: string, categoryId: string) {
  const conditions = ["b.status = 'published'"];
  const params: any[] = [];

  if (q) {
    params.push(q);
    conditions.push(
      "(immutable_unaccent(lower(b.title)) % immutable_unaccent(lower($" +
        params.length +
        ")) OR b.title ILIKE '%' || $" +
        params.length +
        " || '%')"
    );
  }
  if (categoryId) {
    params.push(categoryId);
    conditions.push("b.category_id = $" + params.length);
  }

  const orderBy = q
    ? "similarity(immutable_unaccent(lower(b.title)), immutable_unaccent(lower($1))) DESC"
    : "b.created_at DESC";

  const { rows } = await pool.query(
    `
    SELECT b.id, b.title, b.slug,
           c.name AS category_name,
           p.name AS publisher_name,
           COALESCE(string_agg(a.canonical_name, '، ' ORDER BY ba.sort_order), '') AS authors
    FROM books b
    LEFT JOIN categories c ON c.id = b.category_id
    LEFT JOIN publishers p ON p.id = b.publisher_id
    LEFT JOIN book_authors ba ON ba.book_id = b.id AND ba.role = 'author'
    LEFT JOIN authors a ON a.id = ba.author_id
    WHERE ${conditions.join(" AND ")}
    GROUP BY b.id, c.name, p.name
    ORDER BY ${orderBy}
    LIMIT 50
    `,
    params
  );
  return rows;
}

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const categoryId = params.category || "";
  const [books, categories] = await Promise.all([
    searchBooks(q, categoryId),
    getCategories(),
  ]);

  return (
    <main
      dir="rtl"
      style={{
        padding: "2rem",
        fontFamily: "sans-serif",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <p>
        <a href="/" style={{ color: "inherit" }}>
          المجلس
        </a>{" "}
        — تصفح الكتب
      </p>
      <h1>مكتبة المجلس</h1>

      <form
        style={{
          display: "flex",
          gap: "1rem",
          margin: "1.5rem 0",
          flexWrap: "wrap",
        }}
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="ابحث عن كتاب..."
          style={{ flex: 1, minWidth: 200, padding: 10 }}
        />
        <select
          name="category"
          defaultValue={categoryId}
          style={{ padding: 10 }}
        >
          <option value="">كل التصنيفات</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" style={{ padding: "10px 20px" }}>
          بحث
        </button>
      </form>

      <p style={{ color: "#666" }}>{books.length} نتيجة</p>

      <div style={{ display: "grid", gap: "1rem" }}>
        {books.map((b) => (
          <a
          
            key={b.id}
            href={`/books/${b.slug}`}
            style={{
              display: "block",
              padding: "1rem",
              border: "1px solid #ddd",
              borderRadius: 8,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ fontWeight: "bold", fontSize: 18 }}>{b.title}</div>
            <div style={{ color: "#666" }}>
              {b.authors || "مؤلف غير معروف"}
              {b.publisher_name ? ` — ${b.publisher_name}` : ""}
            </div>
            {b.category_name && (
              <div style={{ fontSize: 13, color: "#999" }}>
                {b.category_name}
              </div>
            )}
          </a>
        ))}
        {books.length === 0 && <p>لا توجد نتائج مطابقة.</p>}
      </div>
    </main>
  );
}
