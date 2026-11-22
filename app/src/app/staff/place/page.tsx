export const dynamic = "force-dynamic";

import { pool } from "@/lib/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getStaffSession } from "@/lib/session";
import { StaffNav } from "@/lib/staff-nav";
import { copyCode, describeShelf, getShelfOptions, normalizeTagUid, parseCopyCode } from "@/lib/copies";

// Stage 2 of the work: stand at one shelf box, then put books into it one
// after another. Cataloguing (تصوير) and placing are separate jobs.

type CopyRow = {
  id: string;
  copy_number: number;
  shelf_code: string | null;
  tag_uid: string | null;
  book_id: string;
  book_number: number;
  title: string;
};

const COPY_COLUMNS = `c.id, c.copy_number, c.shelf_code, c.tag_uid, b.id AS book_id, b.book_number, b.title`;

async function findCopies(q: string): Promise<CopyRow[]> {
  const code = parseCopyCode(q);
  if (code) {
    const { rows } = await pool.query(
      `SELECT ${COPY_COLUMNS} FROM book_copies c JOIN books b ON b.id = c.book_id
       WHERE b.book_number = $1 AND ($2::int IS NULL OR c.copy_number = $2)
       ORDER BY c.copy_number`,
      [code.bookNumber, code.copyNumber]
    );
    return rows;
  }
  const { rows } = await pool.query(
    `SELECT ${COPY_COLUMNS} FROM book_copies c JOIN books b ON b.id = c.book_id
     WHERE b.title_normalized LIKE '%' || immutable_unaccent(lower($1)) || '%'
        OR similarity(b.title_normalized, immutable_unaccent(lower($1))) > 0.3
     ORDER BY similarity(b.title_normalized, immutable_unaccent(lower($1))) DESC, b.book_number, c.copy_number
     LIMIT 25`,
    [q]
  );
  return rows;
}

async function copiesIn(box: string): Promise<CopyRow[]> {
  const { rows } = await pool.query(
    `SELECT ${COPY_COLUMNS} FROM book_copies c JOIN books b ON b.id = c.book_id
     WHERE c.shelf_code = $1 ORDER BY c.updated_at DESC`,
    [box]
  );
  return rows;
}

async function unplaced(): Promise<{ rows: CopyRow[]; total: number }> {
  const [{ rows }, count] = await Promise.all([
    pool.query(
      `SELECT ${COPY_COLUMNS} FROM book_copies c JOIN books b ON b.id = c.book_id
       WHERE c.shelf_code IS NULL AND c.status <> 'withdrawn'
       ORDER BY b.book_number DESC, c.copy_number LIMIT 30`
    ),
    pool.query(`SELECT count(*)::int AS n FROM book_copies WHERE shelf_code IS NULL AND status <> 'withdrawn'`),
  ]);
  return { rows, total: count.rows[0].n };
}

function backTo(box: string, q: string, extra: string): never {
  const p = new URLSearchParams();
  if (box) p.set("box", box);
  if (q) p.set("q", q);
  redirect(`/staff/place?${p.toString()}${extra ? "&" + extra : ""}`);
}

async function placeCopy(formData: FormData) {
  "use server";
  const box = (formData.get("box") as string) || "";
  const q = (formData.get("q") as string) || "";
  const copyId = formData.get("copy_id") as string;
  const session = await getStaffSession();
  if (!session || session.role === "viewer") backTo(box, q, "error=permission");

  const { rows: boxRow } = await pool.query("SELECT code FROM shelf_boxes WHERE code = $1 AND is_active", [box]);
  if (!boxRow[0]) backTo("", q, "error=box");

  const rawTag = ((formData.get("tag_uid") as string) || "").trim();
  const tag = rawTag ? normalizeTagUid(rawTag) : null;
  if (rawTag && !tag) backTo(box, q, "error=tag_format");

  const { rows: before } = await pool.query(
    `SELECT c.tag_uid, c.shelf_code, c.status, c.copy_number, b.book_number
     FROM book_copies c JOIN books b ON b.id = c.book_id WHERE c.id = $1`,
    [copyId]
  );
  if (!before[0]) backTo(box, q, "error=missing_copy");

  if (tag) {
    const { rows: clash } = await pool.query(
      `SELECT b.book_number, c.copy_number FROM book_copies c JOIN books b ON b.id = c.book_id
       WHERE c.tag_uid = $1 AND c.id <> $2`,
      [tag, copyId]
    );
    if (clash[0]) backTo(box, q, `error=tag_used&other=${clash[0].book_number}-${clash[0].copy_number}`);
  }

  const newTag = tag ?? before[0].tag_uid; // an empty field keeps the existing tag
  await pool.query(
    `UPDATE book_copies SET shelf_code = $1, tag_uid = $2, status = 'on_shelf',
       last_seen_at = now(), updated_at = now() WHERE id = $3`,
    [box, newTag, copyId]
  );
  await pool.query(
    `INSERT INTO audit_log (entity_type, entity_id, action, changed_by, before_value, after_value)
     VALUES ('book_copy', $1, 'place', $2, $3, $4)`,
    [
      copyId,
      session!.staffId,
      JSON.stringify({ shelf_code: before[0].shelf_code, tag_uid: before[0].tag_uid, status: before[0].status }),
      JSON.stringify({ shelf_code: box, tag_uid: newTag, status: "on_shelf" }),
    ]
  );
  const jar = await cookies();
  jar.set("last_shelf", box, { path: "/staff", maxAge: 60 * 60 * 12, sameSite: "lax" });
  backTo(box, "", `placed=${before[0].book_number}-${before[0].copy_number}`);
}

async function removeFromBox(formData: FormData) {
  "use server";
  const box = (formData.get("box") as string) || "";
  const copyId = formData.get("copy_id") as string;
  const session = await getStaffSession();
  if (!session || session.role === "viewer") backTo(box, "", "error=permission");
  const { rows } = await pool.query(
    `UPDATE book_copies SET shelf_code = NULL, updated_at = now()
     WHERE id = $1 AND shelf_code = $2 RETURNING id`,
    [copyId, box]
  );
  if (rows[0]) {
    await pool.query(
      `INSERT INTO audit_log (entity_type, entity_id, action, changed_by, before_value, after_value)
       VALUES ('book_copy', $1, 'unplace', $2, $3, $4)`,
      [copyId, session!.staffId, JSON.stringify({ shelf_code: box }), JSON.stringify({ shelf_code: null })]
    );
  }
  backTo(box, "", "");
}

const ERRORS: Record<string, string> = {
  permission: "ليست لديك صلاحية تحديد المواقع.",
  box: "اختر خانة أولًا.",
  tag_format: "رقم الملصق غير صحيح. انسخه كما يظهر في تطبيق NFC Tools (مثل 04:4C:A2:72:D9:2A:81).",
  tag_used: "هذا الملصق مرتبط بنسخة أخرى",
  missing_copy: "لم نجد هذه النسخة.",
};

const card = { backgroundColor: "#F6F0E2", borderRadius: 10, padding: "0.9rem 1rem" } as const;
const input = { padding: 8, fontSize: 16, boxSizing: "border-box" as const };

function CopyLine({ c, box, q }: { c: CopyRow; box: string; q: string }) {
  const here = c.shelf_code === box;
  return (
    <form action={placeCopy} style={{ ...card, display: "grid", gap: 6 }}>
      <input type="hidden" name="box" value={box} />
      <input type="hidden" name="q" value={q} />
      <input type="hidden" name="copy_id" value={c.id} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <span>
          <b dir="ltr" style={{ color: "#9B2226" }}>{copyCode(c.book_number, c.copy_number)}</b> {c.title}
        </span>
        <span style={{ fontSize: 12, color: here ? "#2E7D32" : "#8C7A5E", whiteSpace: "nowrap" }}>
          {here ? "في هذه الخانة" : c.shelf_code ? `الآن في ${c.shelf_code}` : "بدون مكان"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input
          name="tag_uid"
          dir="ltr"
          defaultValue=""
          placeholder={c.tag_uid ? `ملصق: ${c.tag_uid}` : "رقم الملصق (اختياري)"}
          style={{ ...input, flex: "1 1 180px", fontFamily: "monospace", fontSize: 14 }}
        />
        <button
          type="submit"
          disabled={here && !!c.tag_uid}
          style={{ padding: "8px 14px", backgroundColor: here ? "#C9BFA8" : "#9B2226", color: "#EDE3D0", border: "none", borderRadius: 6, fontSize: 14, cursor: "pointer" }}
        >
          {here ? "حفظ الملصق" : `ضع في ${box}`}
        </button>
      </div>
    </form>
  );
}

export default async function PlacePage({
  searchParams,
}: {
  searchParams: Promise<{ box?: string; q?: string; placed?: string; error?: string; other?: string }>;
}) {
  const sp = await searchParams;
  const jar = await cookies();
  const shelves = await getShelfOptions();
  const codes = new Set(shelves.map((s) => s.code));
  const requested = (sp.box || jar.get("last_shelf")?.value || "").toUpperCase();
  const box = codes.has(requested) ? requested : "";
  const boxInfo = shelves.find((s) => s.code === box);
  const q = (sp.q || "").trim();
  const walls = [...new Set(shelves.map((s) => s.wall))];

  const [results, inBox, waiting] = await Promise.all([
    box && q ? findCopies(q) : Promise.resolve([] as CopyRow[]),
    box ? copiesIn(box) : Promise.resolve([] as CopyRow[]),
    box ? unplaced() : Promise.resolve({ rows: [] as CopyRow[], total: 0 }),
  ]);

  return (
    <main style={{ padding: "1.25rem", fontFamily: "sans-serif", maxWidth: 560, margin: "0 auto", backgroundColor: "#EDE3D0", minHeight: "100vh" }}>
      <StaffNav active="place" />
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>تحديد مواقع الكتب</h1>
      <p style={{ fontSize: 13, color: "#5C5040", marginTop: 0 }}>
        اختر الخانة التي تقف أمامها، ثم أضف إليها الكتب واحدًا تلو الآخر.
      </p>

      <form action="/staff/place" method="get" style={{ ...card, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 13 }} htmlFor="box">الخانة</label>
        <select id="box" name="box" defaultValue={box} style={{ ...input, flex: "1 1 140px" }}>
          <option value="">— اختر —</option>
          {walls.map((w) => (
            <optgroup key={w} label={`الجدار ${w}`}>
              {shelves.filter((s) => s.wall === w).map((s) => (
                <option key={s.code} value={s.code}>{s.code}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button type="submit" style={{ padding: "8px 14px", backgroundColor: "#1C1712", color: "#EDE3D0", border: "none", borderRadius: 6 }}>
          اختيار
        </button>
      </form>

      {sp.error && (
        <p style={{ backgroundColor: "#FBEBEB", color: "#9B2226", padding: "8px 12px", borderRadius: 6, fontSize: 14 }}>
          {ERRORS[sp.error] || "تعذّر الحفظ."}
          {sp.error === "tag_used" && sp.other ? <> (<b dir="ltr">{sp.other}</b>).</> : null}
        </p>
      )}
      {sp.placed && (
        <p style={{ backgroundColor: "#E5F4E4", padding: "8px 12px", borderRadius: 6, fontSize: 14 }}>
          تم وضع النسخة <b dir="ltr">{sp.placed}</b> في {box}. التالي؟
        </p>
      )}

      {!box && <p style={{ color: "#5C5040" }}>ابدأ باختيار الخانة.</p>}

      {box && boxInfo && (
        <>
          <div style={{ margin: "1rem 0", textAlign: "center" }}>
            <div style={{ fontSize: 44, fontWeight: 700, color: "#9B2226", lineHeight: 1 }} dir="ltr">{box}</div>
            <div style={{ fontSize: 13, color: "#5C5040", marginTop: 6 }}>{describeShelf(box, boxInfo.wall)}</div>
            <div style={{ fontSize: 13, color: "#5C5040" }}>فيها الآن: {inBox.length} نسخة</div>
          </div>

          <form action="/staff/place" method="get" style={{ display: "flex", gap: 8 }}>
            <input type="hidden" name="box" value={box} />
            <input
              name="q"
              defaultValue={q}
              autoFocus
              placeholder="رقم الكتاب أو عنوانه"
              style={{ ...input, flex: 1 }}
            />
            <button type="submit" style={{ padding: "8px 14px", backgroundColor: "#1C1712", color: "#EDE3D0", border: "none", borderRadius: 6 }}>
              بحث
            </button>
          </form>

          {q && (
            <section style={{ marginTop: "1rem" }}>
              <h2 style={{ fontSize: 15 }}>نتائج «{q}» ({results.length})</h2>
              {results.length === 0 && <p style={{ color: "#8C7A5E", fontSize: 14 }}>لا توجد نتائج. هل أُضيف الكتاب إلى الفهرس؟</p>}
              <div style={{ display: "grid", gap: 8 }}>
                {results.map((c) => <CopyLine key={c.id} c={c} box={box} q={q} />)}
              </div>
            </section>
          )}

          <section style={{ marginTop: "1.5rem" }}>
            <h2 style={{ fontSize: 15 }}>في هذه الخانة ({inBox.length})</h2>
            {inBox.length === 0 && <p style={{ color: "#8C7A5E", fontSize: 14 }}>لا شيء بعد.</p>}
            <div style={{ display: "grid", gap: 6 }}>
              {inBox.map((c) => (
                <form key={c.id} action={removeFromBox} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "0.6rem 0.9rem" }}>
                  <input type="hidden" name="box" value={box} />
                  <input type="hidden" name="copy_id" value={c.id} />
                  <span style={{ fontSize: 14 }}>
                    <b dir="ltr" style={{ color: "#9B2226" }}>{copyCode(c.book_number, c.copy_number)}</b> {c.title}
                    {!c.tag_uid && <span style={{ color: "#8C7A5E", fontSize: 12 }}> · بدون ملصق</span>}
                  </span>
                  <button type="submit" style={{ background: "none", border: "none", color: "#9B2226", fontSize: 13, cursor: "pointer" }}>
                    إزالة
                  </button>
                </form>
              ))}
            </div>
          </section>

          <section style={{ marginTop: "1.5rem" }}>
            <h2 style={{ fontSize: 15 }}>
              كتب بلا مكان ({waiting.total}){waiting.total > waiting.rows.length ? ` — آخر ${waiting.rows.length}` : ""}
            </h2>
            {waiting.total === 0 && <p style={{ color: "#2E7D32", fontSize: 14 }}>كل الكتب لها مكان.</p>}
            <div style={{ display: "grid", gap: 8 }}>
              {waiting.rows.map((c) => <CopyLine key={c.id} c={c} box={box} q="" />)}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
