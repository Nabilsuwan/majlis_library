function StaffNav() {
  return (
    <nav style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", fontSize: 14 }}>
      <a href="/staff/books">الكتب</a>
      <a href="/staff/authors" style={{ fontWeight: "bold" }}>المؤلفون</a>
      <a href="/staff/publishers">الناشرون</a>
    </nav>
  );
}

export default async function StaffAuthorsPage() {
  const authors = await getAuthors();
  const duplicateNames = new Set(
    authors
      .map((a) => a.canonical_name.trim().toLowerCase())
      .filter((name, i, arr) => arr.indexOf(name) !== i)
  );

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <StaffNav />
      <h1>إدارة المؤلفين</h1>

      <section style={{ margin: "2rem 0", padding: "1.5rem", border: "1px solid #ddd", borderRadius: 8 }}>
        <h2>دمج مؤلفَين مكررَين</h2>
        <p style={{ color: "#666", fontSize: 14 }}>
          اختر السجل المكرر (سيُحذف) والسجل الذي يجب الاحتفاظ به. سيتم نقل جميع الكتب إلى السجل المحتفَظ به.
        </p>
        <form action={mergeAuthors} style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <label>
            السجل المكرر (سيُحذف)
            <select name="from_id" required style={{ display: "block", padding: 8, minWidth: 220 }}>
              <option value="">— اختر —</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.canonical_name} ({a.book_count})
                </option>
              ))}
            </select>
          </label>
          <label>
            السجل المحتفَظ به
            <select name="into_id" required style={{ display: "block", padding: 8, minWidth: 220 }}>
              <option value="">— اختر —</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.canonical_name} ({a.book_count})
                </option>
              ))}
            </select>
          </label>
          <button type="submit" style={{ padding: "10px 20px", cursor: "pointer" }}>
            دمج
          </button>
        </form>
      </section>

      <section>
        <h2>جميع المؤلفين ({authors.length})</h2>
        {duplicateNames.size > 0 && (
          <p style={{ color: "#b00", fontSize: 14 }}>
            تنبيه: هناك {duplicateNames.size} اسم مؤلف مكرر أدناه (مظلل) — يُنصح بدمجها.
          </p>
        )}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #ddd", textAlign: "right" }}>
              <th style={{ padding: 8 }}>الاسم</th>
              <th style={{ padding: 8 }}>عدد الكتب</th>
              <th style={{ padding: 8 }}></th>
            </tr>
          </thead>
          <tbody>
            {authors.map((a) => {
              const isDup = duplicateNames.has(a.canonical_name.trim().toLowerCase());
              return (
                <tr
                  key={a.id}
                  style={{
                    borderBottom: "1px solid #eee",
                    background: isDup ? "#fff3f3" : "transparent",
                  }}
                >
                  <td style={{ padding: 8 }}>
                    <form action={renameAuthor} style={{ display: "flex", gap: 8 }}>
                      <input type="hidden" name="id" value={a.id} />
                      <input name="name" defaultValue={a.canonical_name} style={{ padding: 6, flex: 1 }} />
                      <button type="submit" style={{ cursor: "pointer" }}>حفظ</button>
                    </form>
                  </td>
                  <td style={{ padding: 8 }}>{a.book_count}</td>
                  <td style={{ padding: 8 }}></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
