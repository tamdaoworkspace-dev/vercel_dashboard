import "./globals.css";

export const metadata = {
  title: "TDG CSKH Dashboard",
  description: "Báo cáo Năng suất & Kết quả CSKH — TDG Tea",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F3EB" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A08" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
