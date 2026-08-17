import { pool } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth";
import { redirect } from "next/navigation";

async function analyzePhoto(formData: FormData) {
  "use server";

  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0) {
    throw new Error("الرجاء اختيار صورة");
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const mediaType = file.type || "image/jpeg";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text:
                "هذه صورة غلاف كتاب عربي. استخرج المعلومات التالية وأعدها " +
                "بصيغة JSON فقط، بدون أي نص أو شرح إضافي وبدون علامات " +
                "markdown: " +
                '{"title": "عنوان الكتاب", "author": "اسم المؤلف", ' +
                '"publisher": "اسم الناشر", "edition": "رقم الطبعة"}. ' +
                'إذا لم تجد معلومة معينة استخدم قيمة فارغة "".',
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error("فشل تحليل الصورة: " + errText.slice(0, 200));
  }

  const data = await response.json();
  let rawText = data.content?.[0]?.text || "{}";
  rawText = rawText.replace(/```json|```/g, "").trim();

  let suggested;
  try {
    suggested = JSON.parse(rawText);
  } catch {
    suggested = { title: "", author: "", publisher: "", edition: "" };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("majlis_session")?.value;
  const session = token ? await verifySessionToken(token) : null;

  const result = await pool.query(
    `INSERT INTO intake_submissions (suggested_data, status, submitted_by)
     VALUES ($1, 'pending_review', $2)
     RETURNING id`,
    [JSON.stringify(suggested), session?.staffId || null]
  );

  redirect(`/staff/intake/${result.rows[0].id}/review`);
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

export default function IntakePage() {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 500, margin: "0 auto" }}>
      <StaffNav />
      <h1>إضافة كتاب بالتصوير</h1>
      <p style={{ color: "#666" }}>
        صوّر غلاف الكتاب، وسيحاول النظام قراءة العنوان والمؤلف والناشر
        تلقائيًا. ستتمكن من مراجعة النتيجة وتصحيحها قبل الحفظ.
      </p>
      <form action={analyzePhoto} style={{ marginTop: "1.5rem" }}>
        <input
          type="file"
          name="photo"
          accept="image/*"
          capture="environment"
          required
          style={{ display: "block", marginBottom: "1rem" }}
        />
        <button
          type="submit"
          style={{ padding: "10px 24px", cursor: "pointer" }}
        >
          تحليل الصورة
        </button>
      </form>
    </main>
  );
}
