export const metadata = {
  title: "المجلس — مكتبة عربية",
  description: "مكتبة رقمية تضم آلاف الكتب العربية التراثية والعلمية",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
