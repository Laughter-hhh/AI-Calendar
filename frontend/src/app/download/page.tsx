import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "下载安卓 App - AI Calendar",
  description: "下载 AI Calendar 安卓安装包（APK），无需 Expo Go，安装后与网页版数据同步。",
};

const APK_URL = "/api/download/ai-calendar.apk";

export default function DownloadPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 md:px-8">
      <h1 className="text-2xl font-bold">下载安卓 App</h1>
      <p className="mt-2 text-sm text-zinc-500">
        AI Calendar 安卓安装包（APK）：独立应用，无需安装 Expo Go，登录后与网页版数据同步。
      </p>

      <a
        href={APK_URL}
        className="ui-button-primary mt-7 h-12 px-6 text-sm"
      >
        ⬇ 下载 APK 安装包
      </a>

      <section className="ui-card mt-8 p-6 text-sm text-zinc-600">
        <h2 className="text-base font-semibold text-zinc-800">安装步骤</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>点击上方按钮下载 APK 文件</li>
          <li>打开文件管理器，找到下载的 <code className="rounded bg-zinc-100 px-1">ai-calendar.apk</code></li>
          <li>点击安装；若提示“未知来源”，在设置中允许“安装未知应用”</li>
          <li>安装完成后打开 App，用网页版账号登录即可</li>
        </ol>
      </section>

      <section className="ui-card mt-4 p-6 text-sm text-zinc-600">
        <h2 className="text-base font-semibold text-zinc-800">iPhone（iOS）用户</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong>最简单（零成本）</strong>：用 iPhone 自带的 Safari 打开本网站 →
            点底部「分享」按钮 → 「添加到主屏幕」→ 桌面就会出现 AI Calendar 图标，和 App
            一样一键进入。
          </li>
          <li>
            <strong>正规测试版（TestFlight）</strong>：需要 Apple 开发者账号（$99/年），
            构建后通过 TestFlight 分发链接安装——配置已就绪，需要时即可提供链接。
          </li>
          <li>iOS 不允许像安卓那样直接下载安装包，这是苹果平台规则。</li>
        </ul>
      </section>

      <section className="ui-card mt-4 p-6 text-sm text-zinc-600">
        <h2 className="text-base font-semibold text-zinc-800">说明</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>当前为安卓版（Android 7.0+）。iOS 用户可用上方「添加到主屏幕」方式使用。</li>
          <li>App 是网页版的容器，功能更新无需重新安装（刷新即得最新功能）。</li>
          <li>请在浏览器直接下载本 APK；不要从不明网站下载安装包。</li>
        </ul>
      </section>

      <p className="mt-8 text-center text-xs text-zinc-400">
        <Link href="/" className="hover:text-zinc-600">← 返回 AI Calendar</Link>
      </p>
    </main>
  );
}
