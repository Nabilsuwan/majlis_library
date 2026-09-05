export const dynamic = "force-dynamic";

import { pool } from "@/lib/db";
import { BookIcon, FeatherIcon, BuildingIcon, TagIcon } from "@/lib/icons";

function toArabicNumerals(num: number): string {
  const digits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(num)
    .split("")
    .map((d) => digits[parseInt(d)] ?? d)
    .join("");
}

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
    SELECT c.name, COUNT(b.id) AS book_count
    FROM categories c
    LEFT JOIN books b ON b.category_id = c.id AND b.status = 'published'
    GROUP BY c.id, c.name
    ORDER BY book_count DESC
    LIMIT 4
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

function StatItem({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      {icon}
      <strong style={{ fontSize: "2.3rem", fontWeight: 600 }}>{toArabicNumerals(value)}</strong>
      <span style={{ fontSize: "1.3rem", color: "#C9BFA8" }}>{label}</span>
    </div>
  );
}

export default async function Home() {
  const [stats, topCategories, recentBooks] = await Promise.all([
    getStats(),
    getTopCategories(),
    getRecentBooks(),
  ]);

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#EDE3D0", maxWidth: 600, margin: "0 auto" }}>
      <div
        style={{
          backgroundColor: "#2B3A4A",
          color: "#EDE3D0",
          padding: "2.5rem 1.5rem 2rem",
          textAlign: "center",
        }}
      >
        <svg width="220" height="22" viewBox="0 0 220 22" style={{ margin: "0 auto 1rem", display: "block" }}>
          <g stroke="#9B2226" strokeWidth="1" fill="none">
            <line x1="0" y1="11" x2="70" y2="11" />
            <line x1="150" y1="11" x2="220" y2="11" />
            <polygon points="110,2 118,7 118,15 110,20 102,15 102,7" />
            <polygon points="110,6 114,8.5 114,13.5 110,16 106,13.5 106,8.5" />
            <circle cx="80" cy="11" r="2" fill="#9B2226" />
            <circle cx="140" cy="11" r="2" fill="#9B2226" />
          </g>
        </svg>

        <h1 style={{ fontSize: "3.8rem", fontWeight: 500, margin: 0 }}>مكتبة المجلس</h1>
        <p
          style={{
            fontFamily: "var(--font-ui), sans-serif",
            fontSize: "1.7rem",
            color: "#C9BFA8",
            maxWidth: 300,
            margin: "0.75rem auto 0",
            lineHeight: 1.8,
          }}
        >
          مكتبة مرجعية تضم آلاف الكتب العربية التراثية والعلمية، في الفلسفة
          والعقيدة والتصوف والتاريخ وعلوم أخرى.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: "1.75rem", flexWrap: "wrap" }}>
          <StatItem icon={<BookIcon size={28} />} value={stats.books} label="كتاب" />
          <StatItem icon={<FeatherIcon size={28} />} value={stats.authors} label="مؤلف" />
          <StatItem icon={<BuildingIcon size={28} />} value={stats.publishers} label="ناشر" />
          <StatItem icon={<TagIcon size={28} />} value={stats.categories} label="تصنيف" />
        </div>

        <div style={{ marginTop: "1.5rem", maxWidth: 220, marginLeft: "auto", marginRight: "auto" }}>
          
          <a
            href="/books"
            style={{
              display: "block",
              padding: "0.7rem",
              backgroundColor: "#9B2226",
              color: "#EDE3D0",
              textDecoration: "none",
              borderRadius: 4,
              fontSize: 26,
              fontWeight: 500,
            }}
          >
            البحث بالمكتبة
          </a>
        </div>
        
        <a
          href="/staff/login"
          style={{
            display: "block",
            marginTop: "0.85rem",
            fontFamily: "var(--font-ui), sans-serif",
            fontSize: "1.44rem",
            color: "#8C99A8",
          }}
        >
          دخول الموظفين
        </a>
      </div>

      <div style={{ padding: "1.25rem 1.25rem 0.5rem" }}>
        <p
          style={{
            fontFamily: "var(--font-ui), sans-serif",
            fontSize: "1.5rem",
            color: "#9B2226",
            letterSpacing: "0.05em",
            margin: "0 0 0.6rem",
            textAlign: "right",
          }}
        >
          تصفح حسب التصنيف
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          {topCategories.map((c) => (
            <a
            
              key={c.name}
              href={`/books?category=${encodeURIComponent(c.name)}`}
              style={{
                backgroundColor: "#F6F0E2",
                borderRadius: 8,
                padding: 10,
                textAlign: "right",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ fontSize: 26, color: "#1C1712", fontWeight: 500 }}>{c.name}</div>
              <div style={{ fontSize: 22, color: "#8C7A5E", marginTop: 2 }}>
                {toArabicNumerals(Number(c.book_count))} كتابًا
              </div>
            </a>
          ))}
        </div>
      </div>

      <div style={{ padding: "0.5rem 1.25rem 2rem" }}>
        <p
          style={{
            fontFamily: "var(--font-ui), sans-serif",
            fontSize: "1.5rem",
            color: "#9B2226",
            letterSpacing: "0.05em",
            margin: "0.75rem 0 0.6rem",
            textAlign: "right",
          }}
        >
          أضيف حديثًا
        </p>
        {recentBooks.map((b, i) => (
          <a
          
            key={b.slug}
            href={`/books/${b.slug}`}
            style={{
              display: "block",
              backgroundColor: "#F6F0E2",
              borderRadius: 8,
              padding: "10px 12px",
              textAlign: "right",
              textDecoration: "none",
              color: "inherit",
              marginBottom: i === 0 ? 6 : 0,
            }}
          >
            <div style={{ fontSize: 26, color: "#1C1712", fontWeight: 500 }}>{b.title}</div>
            <div style={{ fontSize: 22, color: "#8C7A5E", marginTop: 2 }}>{b.authors || "—"}</div>
          </a>
        ))}
      </div>

      <p
        style={{
          fontFamily: "var(--font-ui), sans-serif",
          fontSize: "1.6rem",
          color: "#8C7A5E",
          textAlign: "center",
          paddingBottom: "1.5rem",
        }}
      >
        حالة الخادم:{" "}
        <a href="/api/health" style={{ color: "#9B2226" }}>
          /api/health
        </a>
      </p>
    </main>
  );
}
