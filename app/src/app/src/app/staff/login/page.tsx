import { pool } from "@/lib/db";
import { createSessionToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

async function login(formData: FormData) {
  "use server";

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  if (!email || !password) {
    throw new Error("البريد الإلكتروني وكلمة المرور مطلوبان");
  }

  const result = await pool.query(
    "SELECT id, email, role, password_hash, is_active FROM staff WHERE lower(email) = $1",
    [email]
  );

  const user = result.rows[0];
  if (!user || !user.is_active) {
    throw new Error("بيانات الدخول غير صحيحة");
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new Error("بيانات الدخول غير صحيحة");
  }

  const token = await createSessionToken({
    staffId: user.id,
    email: user.email,
    role: user.role,
  });

  const cookieStore = await cookies();
  cookieStore.set("majlis_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  redirect("/staff/books");
}

export default function LoginPage() {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 400, margin: "4rem auto" }}>
      <h1>تسجيل الدخول</h1>
      <form action={login} style={{ display: "grid", gap: "1rem" }}>
        <label>
          البريد الإلكتروني
          <input name="email" type="email" required style={{ width: "100%", padding: 8 }} />
        </label>
        <label>
          كلمة المرور
          <input name="password" type="password" required style={{ width: "100%", padding: 8 }} />
        </label>
        <button type="submit" style={{ padding: "10px 20px", cursor: "pointer" }}>
          دخول
        </button>
      </form>
    </main>
  );
}
