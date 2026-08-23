import { pool } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { blobUrl } = await request.json();

  if (!blobUrl) {
    return NextResponse.json({ error: "الرجاء رفع صورة" }, { status: 400 });
  }

  const imgResponse = await fetch(blobUrl);
  const bytes = await imgResponse.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const mediaType = imgResponse.headers.get("content-type") || "image/jpeg";

  const promptText =
    "هذه صورة غلاف كتاب عربي تراثي أو علمي. اقرأ النص بعناية فائقة " +
    "حتى لو كان بخط مزخرف أو فني، فبعض الأغلفة تستخدم خطوطًا زخرفية " +
    "يصعب قراءتها.\n\n" +
    "استخرج ما يلي:\n" +
    "- title: العنوان الكامل للكتاب كما هو مكتوب.\n" +
    "- author: اسم المؤلف الأصلي للكتاب.\n" +
    "- publisher: اسم دار النشر.\n" +
    "- edition: رقم الطبعة (رقم فقط، بدون كلمة طبعة).\n" +
    "- proofreader: اسم المحقق، وهو الشخص الذي قام بتحقيق أو مراجعة " +
    'أو دراسة النص، ويظهر عادة بعد عبارة مثل "تحقيق:" أو ' +
    '"دراسة وتحقيق:" أو "حققه:". هذا مختلف عن المؤلف الأصلي.\n\n' +
    "أعد النتيجة بصيغة JSON فقط، بدون أي نص أو شرح إضافي وبدون " +
    'علامات markdown: {"title": "", "author": "", "publisher": "", ' +
    '"edition": "", "proofreader": ""}. ' +
    "إذا كان أي حقل غير واضح تمامًا في الصورة، اترك قيمته فارغة " +
    '"" بدلاً من التخمين.';

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: promptText },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    return NextResponse.json(
      { error: "فشل تحليل الصورة: " + errText.slice(0, 200) },
      { status: 500 }
    );
  }

  const data = await response.json();
  let rawText = data.content?.[0]?.text || "{}";
  rawText = rawText.replace(/```json|```/g, "").trim();

  let suggested;
  try {
    suggested = JSON.parse(rawText);
  } catch {
    suggested = { title: "", author: "", publisher: "", edition: "", proofreader: "" };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("majlis_session")?.value;
  const session = token ? await verifySessionToken(token) : null;

  const result = await pool.query(
    `INSERT INTO intake_submissions (suggested_data, cover_image_url, status, submitted_by)
     VALUES ($1, $2, 'pending_review', $3)
     RETURNING id`,
    [JSON.stringify(suggested), blobUrl, session?.staffId || null]
  );

  return NextResponse.json({ submissionId: result.rows[0].id });
}
