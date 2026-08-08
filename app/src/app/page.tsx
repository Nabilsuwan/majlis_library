export default function Home() {
  return (
    <main style={{ padding: "3rem", fontFamily: "sans-serif" }}>
      <h1>المجلس — مكتبة عربية</h1>
      <p>الموقع قيد الإنشاء. هذه صفحة مبدئية للتأكد من عمل الخادم وقاعدة البيانات.</p>
      <p>
        تحقق من حالة الاتصال بقاعدة البيانات عبر{" "}
        <a href="/api/health">/api/health</a>
      </p>
    </main>
  );
}
