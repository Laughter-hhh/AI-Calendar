import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { listShares } from "@/lib/shares";
import ShareManager from "@/components/ShareManager";

export default async function SharesPage() {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-zinc-500">
          请先 <a href="/" className="text-zinc-900 underline">登录</a>
        </p>
      </main>
    );
  }

  const shares = listShares(user.id);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">共享日历</h1>
      <p className="mt-2 text-sm text-zinc-500">
        把自己的日历共享给同伴，对方登录后就能在日历中看到你的日程（只读）。
      </p>
      <ShareManager initial={shares} myEmail={user.email} />
      <p className="mt-8 text-center text-xs text-zinc-400">
        <a href="/" className="hover:text-zinc-600">← 返回 AI Calendar</a>
      </p>
    </main>
  );
}
