import { pool } from "@/lib/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth";
import { findOrCreateAuthor, findOrCreatePublisher, slugify } from "@/lib/staff-helpers";
import { randomUUID } from "crypto";

async function getSubmission(id: string) {
  const { rows } = await pool.query(
    "SELECT id, suggested_data, status FROM intake_submissions WHERE id = $1",
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

async function confirmIntake(formData: FormData) {
  "use server";

  const submissionId = formData.get("submission_id") as string;
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

  const bookId = randomUUID();
  const slug = slugify(title, bookId);

  await pool.query(
    `INSERT INTO books (id, title, slug, publisher_id, category_id, quantity, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'published')`,
    [bookId, title, slug, publisherId, categoryId, quantity]
  );

  await pool.query(
    `INSERT INTO book_authors (book_id, author_id, role, sort_order)
     VALUES ($1, $2, 'author', 0)`,
    [bookId, authorId]
  );

  const cookieStore = await cookies();
  const token = cookieStore.get("majlis_session")?.value;
  const session = token ? await verifySessionToken(token) : null;

  await pool.query(
    `UPDATE intake_submissions
     SET status = 'confirmed', resulting_book_id = $1,
         reviewed_by = $2, reviewed_at = now()
     WHERE id = $3`,
    [bookId, session?.staffId || null, submissionId]
  );

  redirect("/staff/books");
}

function StaffNav() {
  return (
    <nav style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", fontSize: 14, alignItems: "center" }}>
      <a href="/staff/books" style={{ fontWeight: "bold" }}>الكتب</a>
      <a href="/staff/authors">المؤلفون</a>
      <a href="/staff/publishers">الناشرون</a>
      <span style={{ flex: 1 }} />
      <a href="/">الرئيسية</a>
      <a href="/staff/logout">تسجيل خروج</a>
    </nav>
  );
}

export default async function IntakeReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [submission, categories] = await Promise.all([
    getSubmission(id),
    getCategories(),
  ]);

  if (!submission) {
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p>لم يتم العثور على هذا الطلب.</p>
        <a href="/staff/intake">العودة</a>
      </main>
    );
  }

  const suggested = submission.suggested_data || {};

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 500, margin: "0 auto" }}>
      <StaffNav />
      <h1>مراجعة البيانات المقترحة</h1>
      <p style={{ color: "#666" }}>
        راجع ما استخرجه النظام من الصورة وصحّح أي خطأ قبل الحفظ. لن يُحفظ
        شيء تلقائيًا.
      </p>
      <form action={confirmIntake} style={{ display: "grid", gap: "1rem", marginTop: "1.5rem" }}>
        <input type="hidden" name="submission_id" value={submission.id} />
        <label>
          العنوان *
          <input
            name="title"
            defaultValue={suggested.title || ""}
            required
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label>
          المؤلف *
          <input
            name="author"
            defaultValue={suggested.author || ""}
            required
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label>
          الناشر
          <input
            name="publisher"
            defaultValue={suggested.publisher || ""}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label>
          التصنيف *
          <select name="category_id" required style={{ width: "100%", padding: 8 }}>
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
          <input
            name="quantity"
            type="number"
            defaultValue={1}
            min={1}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <button type="submit" style={{ padding: "10px 24px", cursor: "pointer" }}>
          تأكيد وحفظ
        </button>
      </form>
      <p style={{ marginTop: "1rem" }}>
        <a href="/staff/intake">إلغاء وتصوير كتاب آخر</a>
      </p>
    </main>
  );
}
