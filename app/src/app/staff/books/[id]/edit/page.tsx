import { pool } from "@/lib/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getStaffSession } from "@/lib/session";
import {
  copyCode,
  describeShelf,
  getShelfOptions,
  normalizeTagUid,
  siteBaseUrl,
} from "@/lib/copies";
import { findOrCreateAuthor, findOrCreatePublisher } from "@/lib/staff-helpers";
import { BookIcon, UsersIcon, BuildingIcon, CameraIcon, HomeIcon, LogoutIcon } from "@/lib/icons";

async function getBook(id: string) {
  const { rows } = await pool.query(
    `
    SELECT b.id, b.book_number, b.title, b.quantity, b.category_id, b.proofreader_name, b.edition_number,
           p.name AS publisher_name,
           COALESCE(
             (SELECT a.canonical_name FROM book_authors ba
              JOIN authors a ON a.id = ba.author_id
              WHERE ba.book_id = b.id AND ba.role = 'author'
              ORDER BY ba.sort_order LIMIT 1),
             ''
           ) AS author_name
    FROM books b
    LEFT JOIN publishers p ON p.id = b.publisher_id
    WHERE b.id = $1
    `,
    [id]
  );
  return rows[0] || null;
}

async function getCopies(bookId: string) {
  const { rows } = await pool.query(
    `SELECT id, copy_number, tag_uid, shelf_code, status, last_seen_at
     FROM book_copies WHERE book_id = $1 ORDER BY copy_number`,
    [bookId]
  );
  return rows;
}

async function saveCopy(formData: FormData) {
  "use server";

  const session = await getStaffSession();
  const bookId = formData.get("book_id") as string;
  const copyId = formData.get("copy_id") as string;
  const back = (q: string) => redirect(`/staff/books/${bookId}/edit?${q}#copies`);

  if (!session || session.role === "viewer") back("error=permission");

  const shelf = ((formData.get("shelf_code") as string) || "").trim() || null;
  const status = formData.get("status") === "missing" ? "missing" : "on_shelf";
  const rawTag = ((formData.get("tag_uid") as string) || "").trim();
  const tag = rawTag ? normalizeTagUid(rawTag) : null;
  if (rawTag && !tag) back("error=tag_format");

  const { rows: before } = await pool.query(
    "SELECT tag_uid, shelf_code, status FROM book_copies WHERE id = $1 AND book_id = $2",
    [copyId, bookId]
  );
  if (!before[0]) back("error=missing_copy");

  if (tag) {
    const { rows: clash } = await pool.query(
      `SELECT b.book_number, c.copy_number FROM book_copies c JOIN books b ON b.id = c.book_id
       WHERE c.tag_uid = $1 AND c.id <> $2`,
      [tag, copyId]
    );
    if (clash[0]) back(`error=tag_used&other=${clash[0].book_number}-${clash[0].copy_number}`);
  }

  const placedNow = shelf && shelf !== before[0].shelf_code;
  await pool.query(
    `UPDATE book_copies SET shelf_code = $1, tag_uid = $2, status = $3,
       last_seen_at = CASE WHEN $4 THEN now() ELSE last_seen_at END, updated_at = now()
     WHERE id = $5`,
    [shelf, tag, status, !!placedNow, copyId]
  );
  await pool.query(
    `INSERT INTO audit_log (entity_type, entity_id, action, changed_by, before_value, after_value)
     VALUES ('book_copy', $1, 'update', $2, $3, $4)`,
    [copyId, session!.staffId, JSON.stringify(before[0]), JSON.stringify({ tag_uid: tag, shelf_code: shelf, status })]
  );

  // Remember the last box used, so the next book defaults to the same place.
  if (shelf) {
    const jar = await cookies();
    jar.set("last_shelf", shelf, { path: "/staff", maxAge: 60 * 60 * 12, sameSite: "lax" });
  }
  back(`saved=${copyId}`);
}

async function getCategories() {
  const { rows } = await pool.query(
    "SELECT id, name FROM categories ORDER BY sort_order"
  );
  return rows;
}

async function updateBook(formData: FormData) {
  "use server";

  const id = formData.get("id") as string;
  const title = (formData.get("title") as string)?.trim();
  const authorName = (formData.get("author") as string)?.trim();
  const publisherName = (formData.get("publisher") as string)?.trim();
  const proofreaderName = (formData.get("proofreader") as string)?.trim();
  const editionNumber = formData.get("edition") ? Number(formData.get("edition")) : null;
  const categoryId = formData.get("category_id") as string;
  const quantity = Number(formData.get("quantity")) || 1;

  if (!title || !authorName || !categoryId) {
    throw new Error("العنوان والمؤلف والتصنيف مطلوبة");
  }

  const authorId = await findOrCreateAuthor(authorName);
  const publisherId = publisherName
    ? await findOrCreatePublisher(publisherName)
    : null;

  await pool.query(
    `UPDATE books SET title = $1, publisher_id = $2, category_id = $3,
     quantity = $4, proofreader_name = $5, edition_number = $6, updated_at = now() WHERE id = $7`,
    [title, publisherId, categoryId, quantity, proofreaderName || null, editionNumber, id]
  );

  await pool.query(
    "DELETE FROM book_authors WHERE book_id = $1 AND role = 'author'",
    [id]
  );
  await pool.query(
    `INSERT INTO book_authors (book_id, author_id, role, sort_order)
     VALUES ($1, $2, 'author', 0)`,
    [id, authorId]
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
      {navLink("/staff/books", true, <BookIcon />, "الكتب")}
      {navLink("/staff/authors", false, <UsersIcon />, "المؤلفون")}
      {navLink("/staff/publishers", false, <BuildingIcon />, "الناشرون")}
      {navLink("/staff/intake", false, <CameraIcon />, "تصوير")}
      <span style={{ flex: 1, minWidth: 8 }} />
      {navLink("/", false, <HomeIcon />, "الرئيسية")}
      {navLink("/staff/logout", false, <LogoutIcon />, "خروج")}
    </nav>
  );
}

const ERRORS: Record<string, string> = {
  permission: "ليست لديك صلاحية تعديل النسخ.",
  tag_format: "رقم الملصق غير صحيح. انسخه كما يظهر في تطبيق NFC Tools (مثل 04:4C:A2:72:D9:2A:81).",
  tag_used: "هذا الملصق مرتبط بنسخة أخرى",
  missing_copy: "لم نجد هذه النسخة.",
};

export default async function EditBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string; other?: string; new?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [book, categories, copies, shelves, baseUrl, jar] = await Promise.all([
    getBook(id),
    getCategories(),
    getCopies(id),
    getShelfOptions(),
    siteBaseUrl(),
    cookies(),
  ]);
  const lastShelf = jar.get("last_shelf")?.value || "";
  const walls = [...new Set(shelves.map((s) => s.wall))];

  if (!book) {
    return (
      <main style={{ padding: "1.25rem", fontFamily: "sans-serif" }}>
        <p>الكتاب غير موجود.</p>
        <a href="/staff/books">العودة إلى قائمة الكتب</a>
      </main>
    );
  }

  return (
    <main style={{ padding: "1.25rem", fontFamily: "sans-serif", maxWidth: 500, margin: "0 auto", backgroundColor: "#EDE3D0", minHeight: "100vh" }}>
      <StaffNav />
      <h1 style={{ fontSize: 20 }}>
        تعديل كتاب <span dir="ltr" style={{ color: "#9B2226" }}>#{book.book_number}</span>
      </h1>
      <form action={updateBook} style={{ display: "grid", gap: "0.85rem", backgroundColor: "#F6F0E2", borderRadius: 10, padding: "1.25rem" }}>
        <input type="hidden" name="id" value={book.id} />
        <label style={{ fontSize: 13 }}>
          العنوان *
          <input name="title" defaultValue={book.title} required style={{ width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box" }} />
        </label>
        <label style={{ fontSize: 13 }}>
          المؤلف *
          <input name="author" defaultValue={book.author_name} required style={{ width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box" }} />
        </label>
        <label style={{ fontSize: 13 }}>
          الناشر
          <input name="publisher" defaultValue={book.publisher_name || ""} style={{ width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box" }} />
        </label>
        <label style={{ fontSize: 13 }}>
          المحقق
          <input name="proofreader" defaultValue={book.proofreader_name || ""} style={{ width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box" }} />
        </label>
        <label style={{ fontSize: 13 }}>
          التصنيف *
          <select name="category_id" defaultValue={book.category_id || ""} required style={{ width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box" }}>
            <option value="">— اختر —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 13 }}>
          رقم الإصدار
          <input name="edition" type="number" defaultValue={book.edition_number || ""} min={1} style={{ width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box" }} />
        </label>
        <label style={{ fontSize: 13 }}>
          عدد النسخ
          <input name="quantity" type="number" defaultValue={book.quantity} min={1} style={{ width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box" }} />
        </label>
        <button
          type="submit"
          style={{ padding: "10px 20px", backgroundColor: "#9B2226", color: "#EDE3D0", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14 }}
        >
          حفظ التعديلات
        </button>
      </form>
      <section id="copies" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>النسخ والموقع</h2>
        <p style={{ fontSize: 13, color: "#5C5040", marginTop: 0 }}>
          لكل نسخة ملصق NFC ومكان على الرف. المكان: حرف المستوى من الأسفل + رقم الخانة من اليمين (مثل C12).
        </p>
        {sp.new && (
          <p style={{ backgroundColor: "#E5F4E4", padding: "8px 12px", borderRadius: 6, fontSize: 14 }}>
            تم حفظ الكتاب. حدِّد الآن مكان النسخة على الرف.
          </p>
        )}
        {sp.error && (
          <p style={{ backgroundColor: "#FBEBEB", color: "#9B2226", padding: "8px 12px", borderRadius: 6, fontSize: 14 }}>
            {ERRORS[sp.error] || "تعذّر الحفظ."}
            {sp.error === "tag_used" && sp.other ? <> (<b dir="ltr">{sp.other}</b>).</> : null}
          </p>
        )}
        <div style={{ display: "grid", gap: 10 }}>
          {copies.map((c) => {
            const code = copyCode(book.book_number, c.copy_number);
            const defaultShelf = c.shelf_code || lastShelf;
            return (
              <form
                key={c.id}
                action={saveCopy}
                style={{
                  backgroundColor: "#F6F0E2",
                  borderRadius: 10,
                  padding: "1rem",
                  display: "grid",
                  gap: "0.6rem",
                  border: sp.saved === c.id ? "2px solid #2E7D32" : "1px solid transparent",
                }}
              >
                <input type="hidden" name="book_id" value={book.id} />
                <input type="hidden" name="copy_id" value={c.id} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <b>
                    النسخة <span dir="ltr">{code}</span>
                  </b>
                  <span style={{ fontSize: 12, color: c.tag_uid ? "#2E7D32" : "#8C7A5E" }}>
                    {c.tag_uid ? "مرتبطة بملصق" : "بدون ملصق"}
                    {sp.saved === c.id ? " · تم الحفظ" : ""}
                  </span>
                </div>
                <label style={{ fontSize: 13 }}>
                  المكان على الرف
                  <select
                    name="shelf_code"
                    defaultValue={defaultShelf}
                    style={{ width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box", fontSize: 16 }}
                  >
                    <option value="">— غير محدد —</option>
                    {walls.map((w) => (
                      <optgroup key={w} label={`الجدار ${w}`}>
                        {shelves
                          .filter((s) => s.wall === w)
                          .map((s) => (
                            <option key={s.code} value={s.code}>
                              {s.code}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                {!c.shelf_code && lastShelf && (
                  <span style={{ fontSize: 12, color: "#5C5040" }}>
                    مقترح: آخر خانة استخدمتها ({lastShelf}). اضغط حفظ لتأكيدها.
                  </span>
                )}
                {c.shelf_code && (
                  <span style={{ fontSize: 12, color: "#5C5040" }}>{describeShelf(c.shelf_code)}</span>
                )}
                <label style={{ fontSize: 13 }}>
                  الرابط الذي يُكتب على الملصق
                  <input
                    readOnly
                    value={`${baseUrl}/b/${code}`}
                    dir="ltr"
                    style={{ width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box", fontFamily: "monospace", fontSize: 13 }}
                  />
                </label>
                <label style={{ fontSize: 13 }}>
                  رقم الملصق (Serial number من تطبيق NFC Tools)
                  <input
                    name="tag_uid"
                    defaultValue={c.tag_uid || ""}
                    dir="ltr"
                    placeholder="04:4C:A2:72:D9:2A:81"
                    style={{ width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box", fontFamily: "monospace" }}
                  />
                </label>
                <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" name="status" value="missing" defaultChecked={c.status === "missing"} />
                  النسخة غير موجودة في مكانها
                </label>
                <button
                  type="submit"
                  style={{ padding: "10px 16px", backgroundColor: "#1C1712", color: "#EDE3D0", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14 }}
                >
                  حفظ النسخة {code}
                </button>
              </form>
            );
          })}
        </div>
        <p style={{ fontSize: 12, color: "#8C7A5E" }}>
          لإضافة نسخة، زِد «عدد النسخ» في النموذج أعلاه واحفظ.
        </p>
      </section>
      <p style={{ marginTop: "1rem", fontSize: 13 }}>
        <a href="/staff/books" style={{ color: "#9B2226" }}>إلغاء والعودة</a>
      </p>
    </main>
  );
}
