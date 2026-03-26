import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "三达通 - 微信通三界",
  description: "想和谁聊，就捏一个谁",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased bg-gray-50">
        {children}
      </body>
    </html>
  );
}
