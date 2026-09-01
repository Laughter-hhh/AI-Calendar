import { cookies } from "next/headers";
import Link from "next/link";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import AuthBar from "@/components/AuthBar";
import { APP_VERSION } from "@/lib/version";

export default async function SettingsPage() {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 pt-[env(safe-area-inset-top)]">
        <p className="text-sm text-zinc-500">
          请先 <Link href="/" className="text-zinc-900 underline">登录</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-[calc(env(safe-area-inset-top)+2.5rem)] md:px-8">
      <h1 className="text-xl font-bold">设置</h1>

      <section className="ui-card mt-6 p-5 md:p-6">
        <h2 className="text-sm font-semibold text-zinc-800">账号</h2>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm text-zinc-600">{user.email}</span>
          <AuthBar email={user.email} />
        </div>
      </section>

      <section className="ui-card mt-4 p-5 md:p-6">
        <h2 className="text-sm font-semibold text-zinc-800">功能</h2>
        <div className="mt-2 flex flex-col gap-2 text-sm">
          <Link href="/notes" className="ui-menu-item bg-sky-50/60">
            📒 笔记本（记录不确定时间要做的待办）
          </Link>
          <Link href="/settings/help" className="ui-menu-item bg-sky-50/60">
            ❓ 帮助与使用说明
          </Link>
          <Link href="/shares" className="ui-menu-item bg-sky-50/60">
            🔗 共享日历（把日程分享给同伴）
          </Link>
          <Link href="/download" className="ui-menu-item bg-sky-50/60">
            📱 下载安卓 App / iPhone 使用说明
          </Link>
        </div>
      </section>

      <section className="ui-card mt-4 p-5 text-sm text-zinc-600 md:p-6">
        <h2 className="text-sm font-semibold text-zinc-800">数据与离线</h2>
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          日程保存在服务器数据库；打开过的日程会按账号缓存到手机本地，断网时可继续查看（离线模式），联网后自动刷新。
        </p>
      </section>

      <section className="ui-card mt-4 p-5 text-sm text-zinc-600 md:p-6">
        <h2 className="text-sm font-semibold text-zinc-800">关于</h2>
        <p className="mt-2 text-xs text-zinc-500">
          AI Calendar · 版本 v{APP_VERSION} · 用一句话安排日程
        </p>
      </section>

      <p className="mt-8 text-center text-xs text-zinc-400">
        <Link href="/" className="hover:text-zinc-600">← 返回 AI Calendar</Link>
      </p>
    </main>
  );
}
