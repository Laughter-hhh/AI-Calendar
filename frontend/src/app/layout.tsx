import type { Metadata } from "next";
import "./globals.css";
import VersionChecker from "@/components/VersionChecker";

export const metadata: Metadata = {
  title: "AI Calendar - AI 时间管理助手",
  description: "用自然语言告诉 AI 你想做什么，自动生成你的日程。",
  manifest: "/manifest.webmanifest",
  icons: {
    apple: "/apple-touch-icon.png",
  },
  other: {
    "theme-color": "#fafafa",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "AI Calendar",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">
        <VersionChecker />
        {children}
      </body>
    </html>
  );
}
