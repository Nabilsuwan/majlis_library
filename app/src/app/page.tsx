import { LibraryIcon, BookIcon, UserIcon } from "@/lib/icons";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#2B3A4A",
        color: "#EDE3D0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 1.5rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 48,
          height: 2,
          backgroundColor: "#9B2226",
          marginBottom: "1.5rem",
        }}
      />
      <LibraryIcon size={40} />
      <h1
        style={{
          fontSize: "3rem",
          fontWeight: 700,
          margin: "0.75rem 0 0",
          letterSpacing: "0.02em",
        }}
      >
        مكتبة المجلس
      </h1>
      <p
        style={{
          fontFamily: "var(--font-ui), sans-serif",
          fontSize: "1.05rem",
          color: "#C9BFA8",
          maxWidth: 480,
          lineHeight: 1.9,
          marginTop: "1rem",
        }}
      >
        مكتبة مرجعية تضم آلاف الكتب العربية التراثية والعلمية، في الفلسفة
        والعقيدة والتصوف والتاريخ وعلوم أخرى.
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          marginTop: "2.5rem",
          fontFamily: "var(--font-ui), sans-serif",
          width: "100%",
          maxWidth: 260,
        }}
      >
        
        <a
          href="/books"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "0.85rem 1.5rem",
            backgroundColor: "#9B2226",
            color: "#EDE3D0",
            textDecoration: "none",
            fontWeight: 600,
            borderRadius: 6,
          }}
        >
          <BookIcon size={18} />
          البحث بالمكتبة
        </a>
        
        <a
          href="/staff/login"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "0.85rem 1.5rem",
            border: "1px solid #C9BFA8",
            color: "#C9BFA8",
            textDecoration: "none",
            fontWeight: 600,
            borderRadius: 6,
          }}
        >
          <UserIcon size={18} />
          دخول الموظفين
        </a>
      </div>

      <p
        style={{
          fontFamily: "var(--font-ui), sans-serif",
          fontSize: "0.8rem",
          color: "#6E7C8C",
          marginTop: "3rem",
        }}
      >
        حالة الخادم:{" "}
        <a href="/api/health" style={{ color: "#8C7A5E" }}>
          /api/health
        </a>
      </p>
    </main>
  );
}
