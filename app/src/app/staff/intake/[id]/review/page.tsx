import { pool } from "@/lib/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth";
import { findOrCreateAuthor, findOrCreatePublisher, slugify } from "@/lib/staff-helpers";
import { randomUUID } from "crypto";
import { BookIcon, UsersIcon, BuildingIcon, CameraIcon, HomeIcon, LogoutIcon } from "@/lib/icons";

async function getSubmission(id: string) {
  const { rows } = await pool.query(
    "SELECT id, suggested_data, cover_image_url, status FROM intake_submissions WHERE id = $1",
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
  const coverImageUrl = formData.get("cover_image_url") as string;
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
    `INSERT INTO books (id, title, slug, publisher_id, category_id, quantity, status, cover_image_url)
     VALUES ($1, $2, $3, $4, $5, $6, 'published', $7)`,
    [bookId, title, slug, publisherId, categoryId, quantity, coverImageUrl || null]
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
      {navLink("/staff/books", false, <BookIcon />, "الكتب")}
      {navLink("/staff/authors", false, <UsersIcon />, "المؤلفون")}
      {navLink("/staff/publishers", false, <BuildingIcon />, "الناشرون")}
      {navLink("/staff/intake", true, <CameraIcon />, "تصوير")}
      <span style={{ flex: 1, minWidth: 8 }} />
      {navLink("/", false, <HomeIcon />, "الرئيسية")}
      {navLink("/staff/logout", false, <LogoutIcon />, "خروج")}
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
      <main style={{ padding: "1.25rem", fontFamily: "sans-serif" }}>
        <p>لم يتم العثور على هذا الطلب.</p>
        <a href="/staff/intake">العودة</a>
      </main>
    );
  }

  const suggested = submission.suggested_data || {};

  return (
    <main style={{ padding: "1.25rem", fontFamily: "sans-serif", maxWidth: 500, margin: "0 auto", backgroundColor: "#EDE3D0", minHeight: "100vh" }}>
      <StaffNav />
      <h1 style={{ fontSize: 20 }}>مراجعة البيانات المقترحة</h1>
      <p style={{ color: "#5C5040", fontSize: 13 }}>
        راجع ما استخرجه النظام من الصورة وصحّح أي خطأ قبل الحفظ. لن يُحفظ شيء تلقائيًا.
      </p>

      {submission.cover_image_url && (
        <img
          src={submission.cover_image_url}
          alt="غلاف الكتاب"
          style={{
            width: "100%",
            maxWidth: 220,
            display: "block",
            margin: "1rem auto",
            borderRadius: 8,
            border: "1px solid #C9BFA8",
          }}
        />
      )}

      <form action={confirmIntake} style={{ display: "grid", gap: "0.85rem", backgroundColor: "#F6F0E2", borderRadius: 10, padding: "1.25rem" }}>
        <input type="hidden" name="submission_id" value={submission.id} />
        <input type="hidden" name="cover_image_url" value={submission.cover_image_url || ""} />
        <label style={{ fontSize: 13 }}>
          العنوان *
          <input name="title" defaultValue={suggested.title || ""} required style={{ width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box" }} />
        </label>
        <label style={{ fontSize: 13 }}>
          المؤلف *
          <input name="author" defaultValue={suggested.author || ""} required style={{ width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box" }} />
        </label>
        <label style={{ fontSize: 13 }}>
          الناشر
          <input name="publisher" defaultValue={suggested.publisher || ""} style={{ width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box" }} />
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
          style={{ padding: "10px 20px", backgroundColor: "#9B2226", color: "#EDE3D0", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14 }}
        >
          تأكيد وحفظ
        </button>
      </form>
      <p style={{ marginTop: "1rem", fontSize: 13 }}>
        <a href="/staff/intake" style={{ color: "#9B2226" }}>إلغاء وتصوير كتاب آخر</a>
      </p>
    </main>
  );
}
