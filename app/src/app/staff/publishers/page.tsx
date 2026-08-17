export const dynamic = "force-dynamic";

import { pool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { BookIcon, UsersIcon, BuildingIcon, CameraIcon, HomeIcon, LogoutIcon } from "@/lib/icons";

async function getPublishers() {
  const { rows } = await pool.query(`
    SELECT p.id, p.name, COUNT(b.id) AS book_count
    FROM publishers p
    LEFT JOIN books b ON b.publisher_id = p.id
    GROUP BY p.id
    ORDER BY p.name
  `);
  return rows;
}

async function renamePublisher(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!id || !name) throw new Error("الاسم مطلوب");
  await pool.query("UPDATE publishers SET name = $1 WHERE id = $2", [name, id]);
  revalidatePath("/staff/publishers");
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
      {navLink("/staff/publishers", true, <BuildingIcon />, "الناشرون")}
      {navLink("/staff/intake", false, <CameraIcon />, "تصوير")}
      <span style={{ flex: 1, minWidth: 8 }} />
      {navLink("/", false, <HomeIcon />, "الرئيسية")}
      {navLink("/staff/logout", false, <LogoutIcon />, "خروج")}
    </nav>
  );
}

export default async function StaffPublishersPage() {
  const publishers = await getPublishers();

  return (
    <main style={{ padding: "1.25rem", fontFamily: "sans-serif", maxWidth: 900, margin: "0 auto", backgroundColor: "#EDE3D0", minHeight: "100vh" }}>
      <StaffNav />
      <h1 style={{ fontSize: 20 }}>إدارة الناشرين</h1>

      <section>
        <h2 style={{ fontSize: 16 }}>جميع الناشرين ({publishers.length})</h2>
        {publishers.length === 0 ? (
          <p style={{ color: "#8C7A5E" }}>لا يوجد ناشرون بعد.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {publishers.map((p) => (
              <div
                key={p.id}
                style={{
                  backgroundColor: "#F6F0E2",
                  borderRadius: 10,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <form action={renamePublisher} style={{ display: "flex", gap: 8, flex: 1 }}>
                  <input type="hidden" name="id" value={p.id} />
                  <input name="name" defaultValue={p.name} style={{ padding: 6, flex: 1, fontSize: 14 }} />
                  <button type="submit" style={{ fontSize: 12, cursor: "pointer" }}>حفظ</button>
                </form>
                <span style={{ fontSize: 12, color: "#8C7A5E", whiteSpace: "nowrap" }}>{p.book_count} كتاب</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
