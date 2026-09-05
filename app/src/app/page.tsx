export const dynamic = "force-dynamic";

import { pool } from "@/lib/db";

async function getStats() {
  const [books, authors, publishers, categories] = await Promise.all([
    pool.query("SELECT COUNT(*) FROM books WHERE status = 'published'"),
    pool.query("SELECT COUNT(*) FROM authors"),
    pool.query("SELECT COUNT(*) FROM publishers"),
    pool.query("SELECT COUNT(*) FROM categories"),
  ]);
  return {
    books: Number(books.rows[0].count),
    authors: Number(authors.rows[0].count),
    publishers: Number(publishers.rows[0].count),
    categories: Number(categories.rows[0].count),
  };
}

async function getTopCategories() {
  const { rows } = await pool.query(`
    SELECT c.id, c.name, COUNT(b.id) AS book_count
    FROM categories c
    LEFT JOIN books b ON b.category_id = c.id AND b.status = 'published'
    GROUP BY c.id, c.name
    ORDER BY book_count DESC
    LIMIT 6
  `);
  return rows;
}

async function getRecentBooks() {
  const { rows } = await pool.query(`
    SELECT b.title, b.slug,
           COALESCE(string_agg(a.canonical_name, '، ' ORDER BY ba.sort_order), '') AS authors
    FROM books b
    LEFT JOIN book_authors ba ON ba.book_id = b.id AND ba.role = 'author'
    LEFT JOIN authors a ON a.id = ba.author_id
    WHERE b.status = 'published'
    GROUP BY b.id, b.created_at
    ORDER BY b.created_at DESC
    LIMIT 2
  `);
  return rows;
}

const ink = "#1E2A33";
const teal = "#0F5C52";
const maroon = "#7A2E2E";
const parchment = "#EDE6D3";
const cardBg = "#F5F0E1";
const bodyText = "#5A5442";
const hairline = "#C9BC98";
const mutedText = "#8A8168";
const amiri = "var(--font-display), serif";
const tajawal = "var(--font-tajawal), sans-serif";

export default async function Home() {
  const [stats, topCategories, recentBooks] = await Promise.all([
    getStats(),
    getTopCategories(),
    getRecentBooks(),
  ]);

  return (
    <main style={{ backgroundColor: parchment, color: ink, fontFamily: tajawal, minHeight: "100vh" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
            padding: "14px 20px",
            borderBottom: `1px solid ${hairline}`,
          }}
        >
          <div style={{ fontFamily: amiri, fontSize: "1.15rem", fontWeight: 700, color: teal }}>
            مكتبة المجلس - الذيد
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 13, flexWrap: "wrap" }}>
            <a href="/" style={{ color: ink, textDecoration: "none" }}>الرئيسية</a>
            <a href="/books" style={{ color: ink, textDecoration: "none" }}>الكتب</a>
            <span style={{ width: 1, height: 14, backgroundColor: hairline }} />
            <a href="/staff/login" style={{ color: mutedText, fontSize: 12, textDecoration: "none" }}>
              دخول الموظفين
            </a>
          </div>
        </div>

        <div style={{ position: "relative", padding: "2.5rem 1.25rem 2rem", overflow: "hidden" }}>
          <svg width="180" height="180" viewBox="0 0 100 100" style={{ position: "absolute", left: -20, top: -15, opacity: 0.3 }}>
            <g fill="none" stroke={maroon} strokeWidth="0.8">
              <path d="M50 5 L61 33 L91 33 L67 51 L76 79 L50 61 L24 79 L33 51 L9 33 L39 33 Z" />
              <circle cx="50" cy="50" r="44" />
            </g>
          </svg>

          <div style={{ position: "relative", maxWidth: 480 }}>
            <h1 style={{ fontFamily: amiri, fontSize: "1.8rem", fontWeight: 700, lineHeight: 1.35, margin: "0 0 0.75rem" }}>
              مكتبة مرجعية تحفظ التراث العربي
            </h1>
            <p style={{ fontSize: "0.9rem", color: bodyText, lineHeight: 1.85, margin: "0 0 1.4rem" }}>
              آلاف الكتب في الفلسفة والعقيدة والتصوف والتاريخ، منظمة كفهرس مخطوطة.
            </p>

            <form action="/books" method="get" style={{ display: "flex", gap: 8, marginBottom: "1.4rem" }}>
              <input
                name="q"
                placeholder="ابحث عن كتاب أو مؤلف..."
                style={{
                  flex: 1,
                  minWidth: 0,
                  backgroundColor: cardBg,
                  border: `1px solid ${hairline}`,
                  borderRadius: 4,
                  padding: "0.6rem 0.85rem",
                  fontSize: 13,
                  color: ink,
                  fontFamily: tajawal,
                }}
              />
              <button
                type="submit"
                style={{
                  backgroundColor: teal,
                  color: parchment,
                  border: "none",
                  borderRadius: 4,
                  padding: "0.6rem 1.1rem",
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: tajawal,
                  cursor: "pointer",
                }}
              >
                بحث
              </button>
            </form>

            <div style={{ fontSize: 12, color: bodyText, borderTop: `1px solid ${hairline}`, paddingTop: 12 }}>
              <span style={{ color: ink, fontWeight: 700 }}>{stats.books}</span> كتاب
              {"  ·  "}
              <span style={{ color: ink, fontWeight: 700 }}>{stats.authors}</span> مؤلف
              {"  ·  "}
              <span style={{ color: ink, fontWeight: 700 }}>{stats.publishers}</span> ناشر
              {"  ·  "}
              <span style={{ color: ink, fontWeight: 700 }}>{stats.categories}</span> تصنيف
            </div>
          </div>
        </div>

        <div style={{ padding: "0.25rem 1.25rem 1.75rem" }}>
          <h2 style={{ fontFamily: amiri, fontSize: "1.05rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
            تصفح حسب التصنيف
          </h2>
          <div style={{ borderTop: `1px solid ${hairline}`, marginTop: 8 }}>
            {topCategories.map((c) => (
              <a
                key={c.id}
                href={`/books?category=${c.id}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.7rem 0",
                  borderBottom: `1px solid ${hairline}`,
                  fontSize: 13,
                  color: ink,
                  textDecoration: "none",
                }}
              >
                <span>{c.name}</span>
                <span style={{ color: maroon }}>{c.book_count} كتابًا</span>
              </a>
            ))}
          </div>
        </div>

        <div style={{ padding: "0 1.25rem 2rem" }}>
          <h2 style={{ fontFamily: amiri, fontSize: "1.05rem", fontWeight: 700, margin: "0 0 0.75rem" }}>
            أضيف حديثًا
          </h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {recentBooks.map((b) => (
              <a
              
                key={b.slug}
                href={`/books/${b.slug}`}
                style={{
                  flex: "1 1 200px",
                  backgroundColor: cardBg,
                  border: `1px solid ${hairline}`,
                  borderRadius: 4,
                  padding: "0.9rem",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ fontFamily: amiri, fontSize: 14, fontWeight: 700, color: ink }}>{b.title}</div>
                <div style={{ fontSize: 12, color: bodyText, marginTop: 5 }}>{b.authors || "—"}</div>
              </a>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
            padding: "0.9rem 1.25rem",
            borderTop: `1px solid ${hairline}`,
            fontSize: 12,
            color: mutedText,
          }}
        >
          <span>© مكتبة المجلس - الذيد</span>
          <a href="/staff/login" style={{ color: mutedText, textDecoration: "none" }}>
            دخول الموظفين
          </a>
        </div>

      </div>
    </main>
  );
}
