import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI角色对话 - 创建你的专属AI伙伴",
  description: "创建、定制AI角色，与他们进行智能对话",
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
