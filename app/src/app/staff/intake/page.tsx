"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookIcon, UsersIcon, BuildingIcon, CameraIcon, HomeIcon, LogoutIcon, PinIcon } from "@/lib/icons";

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
      {navLink("/staff/place", false, <PinIcon />, "المواقع")}
      <span style={{ flex: 1, minWidth: 8 }} />
      {navLink("/", false, <HomeIcon />, "الرئيسية")}
      {navLink("/staff/logout", false, <LogoutIcon />, "خروج")}
    </nav>
  );
}

export default function IntakePage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "uploading" | "analyzing">("idle");
  const [error, setError] = useState("");
  const [added, setAdded] = useState<{ number: string; id: string } | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const number = p.get("added");
    const id = p.get("book");
    if (number && id) setAdded({ number, id });
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const input = e.currentTarget.elements.namedItem("photo") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      setError("الرجاء اختيار صورة");
      return;
    }

    try {
      setStatus("uploading");
      const form = new FormData();
      form.append("photo", file);
      const up = await fetch("/api/intake/upload", { method: "POST", body: form });
      if (!up.ok) {
        const data = await up.json().catch(() => ({}));
        throw new Error(data.error || "فشل رفع الصورة");
      }
      const { url: coverUrl } = await up.json();

      setStatus("analyzing");
      const res = await fetch("/api/intake/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ coverUrl }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "فشل تحليل الصورة");
      }

      const data = await res.json();
      router.push(`/staff/intake/${data.submissionId}/review`);
    } catch (err) {
      setStatus("idle");
      setError((err as Error).message || "حدث خطأ غير متوقع");
    }
  }

  return (
    <main style={{ padding: "1.25rem", fontFamily: "sans-serif", maxWidth: 500, margin: "0 auto", backgroundColor: "#EDE3D0", minHeight: "100vh" }}>
      <StaffNav />
      {added && (
        <p style={{ backgroundColor: "#E5F4E4", padding: "10px 12px", borderRadius: 8, fontSize: 14, lineHeight: 1.8 }}>
          تم حفظ الكتاب رقم <b dir="ltr">#{added.number}</b>. صوّر الكتاب التالي.
          <br />
          <a href={`/staff/books/${added.id}/edit#copies`} style={{ color: "#1C1712" }}>تحديد مكانه الآن</a>
          {" · "}
          <a href="/staff/place" style={{ color: "#1C1712" }}>صفحة المواقع</a>
        </p>
      )}
      <h1 style={{ fontSize: 20 }}>إضافة كتاب بالتصوير</h1>
      <p style={{ color: "#5C5040", fontSize: 13 }}>
        صوّر غلاف الكتاب، وسيحاول النظام قراءة العنوان والمؤلف والناشر
        تلقائيًا. ستتمكن من مراجعة النتيجة وتصحيحها قبل الحفظ.
      </p>
      <form onSubmit={handleSubmit} style={{ marginTop: "1.25rem", backgroundColor: "#F6F0E2", borderRadius: 10, padding: "1.25rem" }}>
        <input
          type="file"
          name="photo"
          accept="image/*"
          capture="environment"
          required
          disabled={status !== "idle"}
          style={{ display: "block", marginBottom: "1rem", width: "100%" }}
        />
        {error && (
          <p style={{ color: "#9B2226", fontSize: 13, marginBottom: "1rem" }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={status !== "idle"}
          style={{
            width: "100%",
            padding: "12px 24px",
            backgroundColor: status !== "idle" ? "#C9BFA8" : "#9B2226",
            color: "#EDE3D0",
            border: "none",
            borderRadius: 6,
            cursor: status !== "idle" ? "default" : "pointer",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <CameraIcon size={16} />
          {status === "idle" && "تحليل الصورة"}
          {status === "uploading" && "جارٍ رفع الصورة..."}
          {status === "analyzing" && "جارٍ تحليل الصورة..."}
        </button>
      </form>
    </main>
  );
}
