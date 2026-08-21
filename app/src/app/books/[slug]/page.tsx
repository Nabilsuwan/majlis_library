export const dynamic = "force-dynamic";

import { pool } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

async function getBook(slug: string) {
  const { rows } = await pool.query(
    `
    SELECT b.id, b.title, b.subtitle, b.edition_number, b.page_count, b.slug, b.cover_image_url, b.proofreader_name,
           c.name AS category_name,
           p.name AS publisher_name,
           COALESCE(string_agg(a.canonical_name, '، ' ORDER BY ba.sort_order), '') AS authors
    FROM books b
    LEFT JOIN categories c ON c.id = b.category_id
    LEFT JOIN publishers p ON p.id = b.publisher_id
    LEFT JOIN book_authors ba ON ba.book_id = b.id AND ba.role = 'author'
    LEFT JOIN authors a ON a.id = ba.author_id
    WHERE b.slug = $1 AND b.status = 'published'
    GROUP BY b.id, c.name, p.name
    `,
    [slug]
  );
  return rows[0] || null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const book = await getBook(slug);
  if (!book) return { title: "الكتاب غير موجود" };
  return {
    title: `${book.title} — المجلس`,
    description: book.authors ? `${book.title} — ${book.authors}` : book.title,
  };
}

function ColophonRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "110px 1fr",
        gap: "1rem",
        padding: "0.6rem 0",
        borderTop: "1px solid #C9BFA8",
      }}
    >
      <dt
        style={{
          fontFamily: "var(--font-ui), sans-serif",
          fontSize: "0.8rem",
          color: "#9B2226",
          fontWeight: 600,
        }}
      >
        {label}
      </dt>
      <dd style={{ margin: 0, fontSize: "1.05rem" }}>{value}</dd>
    </div>
  );
}

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const book = await getBook(slug);
  if (!book) notFound();

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "1.5rem 1.5rem 6rem" }}>
      <p style={{ fontFamily: "var(--font-ui), sans-serif", fontSize: "0.85rem" }}>
        <a href="/" style={{ color: "#9B2226", textDecoration: "none" }}>
          المجلس
        </a>
        <span style={{ color: "#8C7A5E" }}>
          {" "}
          /{" "}
        </span>
        <a href="/books" style={{ color: "#9B2226", textDecoration: "none" }}>
          تصفح الكتب
        </a>
      </p>

      {book.cover_image_url && (
        <img
          src={book.cover_image_url}
          alt={book.title}
          style={{
            width: "100%",
            maxWidth: 260,
            display: "block",
            margin: "1.5rem auto 0",
            borderRadius: 8,
            border: "1px solid #C9BFA8",
          }}
        />
      )}

      <h1 style={{ fontSize: "2.3rem", margin: "1.25rem 0 0", lineHeight: 1.3, textAlign: book.cover_image_url ? "center" : "left" }}>
        {book.title}
      </h1>
      {book.subtitle && (
        <p
          style={{
            fontSize: "1.2rem",
            color: "#5C5040",
            margin: "0.5rem 0 0",
            textAlign: book.cover_image_url ? "center" : "left",
          }}
        >
          {book.subtitle}
        </p>
      )}

      <div
        style={{
          marginTop: "2.5rem",
          padding: "1.75rem",
          backgroundColor: "#F6F0E2",
          border: "1px solid #C9BFA8",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-ui), sans-serif",
            fontSize: "0.75rem",
            color: "#8C7A5E",
            margin: "0 0 0.5rem",
            textAlign: "center",
          }}
        >
          — بيانات الكتاب —
        </p>
        <dl style={{ margin: 0 }}>
          <ColophonRow label="المؤلف" value={book.authors || "غير معروف"} />
          <ColophonRow label="الناشر" value={book.publisher_name || "—"} />
          <ColophonRow label="التصنيف" value={book.category_name || "—"} />
          {book.edition_number && (
            <ColophonRow label="الطبعة" value={String(book.edition_number)} />
          )}
          {book.page_count && (
            <ColophonRow label="الصفحات" value={String(book.page_count)} />
          )}
          {book.proofreader_name && (
            <ColophonRow label="المدقق" value={book.proofreader_name} />
          )}
        </dl>
      </div>

      <p
        style={{
          marginTop: "2rem",
          fontFamily: "var(--font-ui), sans-serif",
          fontSize: "0.9rem",
          color: "#5C5040",
          textAlign: "center",
        }}
      >
        هذا الكتاب متاح للاطلاع في المكتبة — مجموعة مرجعية لا تُعار.
      </p>
    </main>
  );
}
