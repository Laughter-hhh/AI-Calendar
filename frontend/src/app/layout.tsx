import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Calendar - AI 时间管理助手",
  description: "用自然语言告诉 AI 你想做什么，自动生成你的日程。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
