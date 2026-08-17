import { pool } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BookIcon, UsersIcon, BuildingIcon, CameraIcon, HomeIcon, LogoutIcon } from "@/lib/icons";

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

export default function IntakePage() {
  return (
    <main style={{ padding: "1.25rem", fontFamily: "sans-serif", maxWidth: 500, margin: "0 auto", backgroundColor: "#EDE3D0", minHeight: "100vh" }}>
      <StaffNav />
      <h1 style={{ fontSize: 20 }}>إضافة كتاب بالتصوير</h1>
      <p style={{ color: "#5C5040", fontSize: 13 }}>
        صوّر غلاف الكتاب، وسيحاول النظام قراءة العنوان والمؤلف والناشر
        تلقائيًا. ستتمكن من مراجعة النتيجة وتصحيحها قبل الحفظ.
      </p>
      <form action={analyzePhoto} style={{ marginTop: "1.25rem", backgroundColor: "#F6F0E2", borderRadius: 10, padding: "1.25rem" }}>
        <input
          type="file"
          name="photo"
          accept="image/*"
          capture="environment"
          required
          style={{ display: "block", marginBottom: "1rem", width: "100%" }}
        />
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "12px 24px",
            backgroundColor: "#9B2226",
            color: "#EDE3D0",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <CameraIcon size={16} />
          تحليل الصورة
        </button>
      </form>
    </main>
  );
}
