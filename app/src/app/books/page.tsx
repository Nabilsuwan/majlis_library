export const dynamic = "force-dynamic";

import { pool } from "@/lib/db";
import { SearchIcon, FeatherIcon, BuildingIcon } from "@/lib/icons";

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
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "1.5rem 1.25rem 4rem", backgroundColor: "#EDE3D0", minHeight: "100vh" }}>
      <p style={{ fontFamily: "var(--font-ui), sans-serif", fontSize: "0.85rem" }}>
        <a href="/" style={{ color: "#9B2226", textDecoration: "none" }}>
          المجلس
        </a>
        <span style={{ color: "#8C7A5E" }}> / تصفح الكتب</span>
      </p>
      <h1 style={{ fontSize: "1.7rem", margin: "0.5rem 0 1.25rem" }}>
        فهرس المكتبة
      </h1>

      <form
        style={{
          display: "flex",
          gap: "0.6rem",
          marginBottom: "1.5rem",
          fontFamily: "var(--font-ui), sans-serif",
          flexWrap: "wrap",
          alignItems: "center",
          backgroundColor: "#F6F0E2",
          borderRadius: 10,
          padding: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 180, backgroundColor: "#fff", border: "1px solid #C9BFA8", borderRadius: 6, padding: "0.5rem 0.75rem" }}>
          <SearchIcon size={16} />
          <input
            name="q"
            defaultValue={q}
            placeholder="ابحث عن كتاب..."
            style={{ border: "none", outline: "none", flex: 1, fontSize: 14, background: "transparent" }}
          />
        </div>
        <select
          name="category"
          defaultValue={categoryId}
          style={{
            padding: "0.55rem 0.75rem",
            border: "1px solid #C9BFA8",
            backgroundColor: "#fff",
            borderRadius: 6,
            fontSize: 14,
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
            padding: "0.55rem 1.25rem",
            backgroundColor: "#9B2226",
            color: "#EDE3D0",
            border: "none",
            borderRadius: 6,
            fontFamily: "var(--font-ui), sans-serif",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
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
          marginBottom: "0.75rem",
        }}
      >
        {books.length} نتيجة
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {books.map((b) => (
          
          <a
            key={b.id}
            href={`/books/${b.slug}`}
            style={{
              display: "block",
              padding: "1rem 1.1rem",
              backgroundColor: "#F6F0E2",
              borderRadius: 10,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ fontSize: "1.15rem", fontWeight: 700 }}>{b.title}</div>
              {b.category_name && (
                <span style={{ backgroundColor: "#9B2226", color: "#F6E9E9", fontSize: 11, padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
                  {b.category_name}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontFamily: "var(--font-ui), sans-serif", fontSize: "0.82rem", color: "#5C5040" }}>
              <FeatherIcon />
              {b.authors || "مؤلف غير معروف"}
            </div>
            {b.publisher_name && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, fontFamily: "var(--font-ui), sans-serif", fontSize: "0.82rem", color: "#5C5040" }}>
                <BuildingIcon size={14} />
                {b.publisher_name}
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
