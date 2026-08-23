import type { Metadata } from "next";
import { Amiri, IBM_Plex_Sans_Arabic } from "next/font/google";

const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-display",
});

const plexSans = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  variable: "--font-ui",
});

export const metadata: Metadata = {
  title: "المجلس — مكتبة عربية",
  description: "مكتبة رقمية تضم آلاف الكتب العربية التراثية والعلمية",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${amiri.variable} ${plexSans.variable}`}>
      <body
        style={{
          margin: 0,
          fontFamily: "var(--font-display), serif",
          backgroundColor: "#EDE3D0",
          color: "#1C1712",
        }}
      >
        <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
        <script dangerouslySetInnerHTML={{ __html: "eruda.init();" }} />
        {children}
      </body>
    </html>
  );
}
