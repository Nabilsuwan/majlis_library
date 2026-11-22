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

export function StaffNav({ active }: { active: "books" | "authors" | "publishers" | "intake" | "place" }) {
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
      {navLink("/staff/books", active === "books", <BookIcon />, "الكتب")}
      {navLink("/staff/authors", active === "authors", <UsersIcon />, "المؤلفون")}
      {navLink("/staff/publishers", active === "publishers", <BuildingIcon />, "الناشرون")}
      {navLink("/staff/intake", active === "intake", <CameraIcon />, "تصوير")}
      {navLink("/staff/place", active === "place", <PinIcon />, "المواقع")}
      <span style={{ flex: 1, minWidth: 8 }} />
      {navLink("/", false, <HomeIcon />, "الرئيسية")}
      {navLink("/staff/logout", false, <LogoutIcon />, "خروج")}
    </nav>
  );
}
