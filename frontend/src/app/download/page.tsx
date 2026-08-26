import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "下载安卓 App - AI Calendar",
  description: "下载 AI Calendar 安卓安装包（APK），无需 Expo Go，安装后与网页版数据同步。",
};

const APK_URL = "/api/download/ai-calendar.apk";

export default function DownloadPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold">下载安卓 App</h1>
      <p className="mt-2 text-sm text-zinc-500">
        AI Calendar 安卓安装包（APK）：独立应用，无需安装 Expo Go，登录后与网页版数据同步。
      </p>

      <a
        href={APK_URL}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-700"
      >
        ⬇ 下载 APK 安装包
      </a>

      <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
        <h2 className="text-base font-semibold text-zinc-800">安装步骤</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>点击上方按钮下载 APK 文件</li>
          <li>打开文件管理器，找到下载的 <code className="rounded bg-zinc-100 px-1">ai-calendar.apk</code></li>
          <li>点击安装；若提示“未知来源”，在设置中允许“安装未知应用”</li>
          <li>安装完成后打开 App，用网页版账号登录即可</li>
        </ol>
      </section>

      <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
        <h2 className="text-base font-semibold text-zinc-800">说明</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>当前为安卓版（Android 7.0+）。iOS 版需 Apple 开发者账号，暂未上架，可用 Safari 直接访问网页版。</li>
          <li>App 是网页版的容器，功能更新无需重新安装（刷新即得最新功能）。</li>
          <li>请在浏览器直接下载本 APK；不要从不明网站下载安装包。</li>
        </ul>
      </section>

      <p className="mt-8 text-center text-xs text-zinc-400">
        <a href="/" className="hover:text-zinc-600">← 返回 AI Calendar</a>
      </p>
    </main>
  );
}
