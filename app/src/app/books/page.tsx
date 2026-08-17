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
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "3rem 1.5rem 6rem" }}>
      <p style={{ fontFamily: "var(--font-ui), sans-serif", fontSize: "0.85rem" }}>
        <a href="/" style={{ color: "#9B2226", textDecoration: "none" }}>
          المجلس
        </a>
        <span style={{ color: "#8C7A5E" }}> / تصفح الكتب</span>
      </p>
      <h1 style={{ fontSize: "2.1rem", margin: "0.5rem 0 2rem" }}>
        فهرس المكتبة
      </h1>

      <form
        style={{
          display: "flex",
          gap: "0.75rem",
          marginBottom: "2rem",
          fontFamily: "var(--font-ui), sans-serif",
          flexWrap: "wrap",
        }}
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="ابحث عن كتاب..."
          style={{
            flex: 1,
            minWidth: 200,
            padding: "0.7rem 1rem",
            border: "1px solid #C9BFA8",
            backgroundColor: "#F6F0E2",
            borderRadius: 2,
          }}
        />
        <select
          name="category"
          defaultValue={categoryId}
          style={{
            padding: "0.7rem 1rem",
            border: "1px solid #C9BFA8",
            backgroundColor: "#F6F0E2",
            borderRadius: 2,
          }}
        >
          <option value="">كل التصنيفات</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          style={{
            padding: "0.7rem 1.5rem",
            backgroundColor: "#1C1712",
            color: "#EDE3D0",
            border: "none",
            borderRadius: 2,
            fontFamily: "var(--font-ui), sans-serif",
            fontWeight: 600,
          }}
        >
          بحث
        </button>
      </form>

      <p
        style={{
          fontFamily: "var(--font-ui), sans-serif",
          fontSize: "0.8rem",
          color: "#8C7A5E",
          marginBottom: "1rem",
        }}
      >
        {books.length} نتيجة
      </p>

      <div>
        {books.map((b) => (
          
          <a
            key={b.id}
            href={`/books/${b.slug}`}
            style={{
              display: "block",
              padding: "1.25rem 0",
              borderTop: "1px solid #C9BFA8",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>
              {b.title}
            </div>
            <div
              style={{
                fontFamily: "var(--font-ui), sans-serif",
                fontSize: "0.85rem",
                color: "#5C5040",
                marginTop: "0.35rem",
              }}
            >
              {b.authors || "مؤلف غير معروف"}
              {b.publisher_name ? ` — ${b.publisher_name}` : ""}
            </div>
            {b.category_name && (
              <div
                style={{
                  fontFamily: "var(--font-ui), sans-serif",
                  fontSize: "0.75rem",
                  color: "#9B2226",
                  marginTop: "0.25rem",
                }}
              >
                {b.category_name}
              </div>
            )}
          </a>
        ))}
        {books.length === 0 && (
          <p style={{ fontFamily: "var(--font-ui), sans-serif", color: "#8C7A5E" }}>
            لا توجد نتائج مطابقة.
          </p>
        )}
      </div>
    </main>
  );
}
