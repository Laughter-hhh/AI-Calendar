import type { Metadata, Viewport } from "next";
import "./globals.css";
import OfflineRegistrar from "@/components/OfflineRegistrar";
import SwipeBack from "@/components/SwipeBack";
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

// 允许网页内容延伸到刘海屏区域，配合 safe-area 内边距避免被状态栏遮挡
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">
        <OfflineRegistrar />
        <SwipeBack />
        <VersionChecker />
        {children}
      </body>
    </html>
  );
}
