import "./globals.css";
export const metadata = { title: "FX" };
export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
