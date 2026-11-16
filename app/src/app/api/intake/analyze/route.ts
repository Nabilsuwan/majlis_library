import { pool } from "@/lib/db";
import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/session";
import { CONTENT_TYPES, coverNameFromUrl, coverPath } from "@/lib/covers";

export async function POST(request: Request) {
  // Check login BEFORE doing anything that costs money (the Claude API call).
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const coverUrl: string = body.coverUrl || "";

  // Only accept covers that were uploaded to our own covers folder — never
  // fetch arbitrary URLs from the server.
  const name = coverNameFromUrl(coverUrl);
  if (!name) {
    return NextResponse.json({ error: "الرجاء رفع صورة" }, { status: 400 });
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(coverPath(name));
  } catch {
    return NextResponse.json({ error: "لم يتم العثور على الصورة" }, { status: 404 });
  }
  const base64 = bytes.toString("base64");
  const mediaType = CONTENT_TYPES[name.split(".").pop() as string] || "image/jpeg";

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

  const result = await pool.query(
    `INSERT INTO intake_submissions (suggested_data, cover_image_url, status, submitted_by)
     VALUES ($1, $2, 'pending_review', $3)
     RETURNING id`,
    [JSON.stringify(suggested), coverUrl, session.staffId]
  );

  return NextResponse.json({ submissionId: result.rows[0].id });
}
