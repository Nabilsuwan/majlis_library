export const dynamic = "force-dynamic";

import { pool } from "@/lib/db";
import { redirect } from "next/navigation";
import { parseCopyCode } from "@/lib/copies";

// Short link written into NFC tags and QR labels: /b/123 or /b/123-2.
export default async function ShortLinkPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const parsed = parseCopyCode(decodeURIComponent(code));

  let target: string | null = null;
  if (parsed) {
    const { rows } = await pool.query(
      "SELECT slug FROM books WHERE book_number = $1 AND status = 'published'",
      [parsed.bookNumber]
    );
    if (rows[0]?.slug) {
      target =
        `/books/${encodeURIComponent(rows[0].slug)}` +
        (parsed.copyNumber ? `?copy=${parsed.copyNumber}#copies` : "");
    }
  }
  if (target) redirect(target);

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "3rem 1.5rem", textAlign: "center" }}>
      <h1 style={{ fontSize: "1.6rem" }}>لم نجد هذا الكتاب</h1>
      <p style={{ color: "#5C5040", lineHeight: 1.9 }}>
        الرمز <b dir="ltr">{decodeURIComponent(code)}</b> غير مرتبط بأي كتاب في الفهرس حاليًا.
        قد يكون الملصق جديدًا لم يُربط بعد، أو أن الكتاب أُزيل من الفهرس.
      </p>
      <p>
        <a href="/books" style={{ color: "#9B2226" }}>البحث في الكتب</a>
      </p>
    </main>
  );
}
