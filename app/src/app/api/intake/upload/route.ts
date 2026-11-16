import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { getStaffSession } from "@/lib/session";
import {
  ALLOWED_TYPES,
  COVERS_DIR,
  MAX_COVER_BYTES,
  coverPath,
  coverUrl,
} from "@/lib/covers";

// Staff-only: receives a cover photo and saves it to the covers folder.
export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "الرجاء اختيار صورة" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "نوع الصورة غير مدعوم (JPG أو PNG أو WEBP فقط)" },
      { status: 400 }
    );
  }
  if (file.size > MAX_COVER_BYTES) {
    return NextResponse.json(
      { error: "حجم الصورة كبير جدًا (الحد الأقصى 15 ميغابايت)" },
      { status: 400 }
    );
  }

  const name = `${randomUUID()}.${ext}`;
  await mkdir(COVERS_DIR, { recursive: true });
  await writeFile(coverPath(name), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ url: coverUrl(name) });
}
