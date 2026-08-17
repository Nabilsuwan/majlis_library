export const dynamic = "force-dynamic";

import { pool } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

async function getBook(slug: string) {
  const { rows } = await pool.query(
    `
    SELECT b.id, b.title, b.subtitle, b.edition_number, b.page_count, b.slug,
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

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const book = await getBook(slug);
  if (!book) notFound();

  return (
    <main
      dir="rtl"
      style={{
        padding: "2rem",
        fontFamily: "sans-serif",
        maxWidth: 700,
        margin: "0 auto",
      }}
    >
      <p>
        <a href="/books">→ العودة إلى التصفح</a>
      </p>
      <h1>{book.title}</h1>
      {book.subtitle && (
        <h2 style={{ fontWeight: "normal", color: "#666" }}>
          {book.subtitle}
        </h2>
      )}
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "150px 1fr",
          gap: "0.5rem 1rem",
          marginTop: "1.5rem",
        }}
      >
        <dt style={{ color: "#666" }}>المؤلف</dt>
        <dd>{book.authors || "غير معروف"}</dd>
        <dt style={{ color: "#666" }}>الناشر</dt>
        <dd>{book.publisher_name || "—"}</dd>
        <dt style={{ color: "#666" }}>التصنيف</dt>
        <dd>{book.category_name || "—"}</dd>
        {book.edition_number && (
          <>
            <dt style={{ color: "#666" }}>الطبعة</dt>
            <dd>{book.edition_number}</dd>
          </>
        )}
        {book.page_count && (
          <>
            <dt style={{ color: "#666" }}>عدد الصفحات</dt>
            <dd>{book.page_count}</dd>
          </>
        )}
      </dl>
      <p
        style={{
          marginTop: "1.5rem",
          padding: "1rem",
          background: "#f5f5f5",
          borderRadius: 8,
        }}
      >
        هذا الكتاب متاح للاطلاع في المكتبة (مجموعة مرجعية، لا تُعار).
      </p>
    </main>
  );
}
