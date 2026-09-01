"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SharesState } from "@/lib/shares";

export default function ShareManager({
  initial,
  myEmail,
}: {
  initial: SharesState;
  myEmail: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function share() {
    const target = email.trim();
    if (!target) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "共享失败");
        return;
      }
      setEmail("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(targetEmail: string) {
    await fetch(`/api/shares?email=${encodeURIComponent(targetEmail)}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <section className="ui-card p-6">
        <h2 className="text-base font-semibold text-zinc-800">共享我的日历</h2>
        <p className="mt-1 text-xs text-zinc-400">
          输入对方注册时的邮箱（你的账号：{myEmail}），对方登录后即可查看你的日程（只读）。
        </p>
        <div className="mt-3 flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && share()}
            placeholder="对方的注册邮箱"
            className="ui-input h-10 min-w-0 flex-1 px-3 text-sm"
          />
          <button
            onClick={share}
            disabled={busy || !email.trim()}
            className="ui-button-primary h-10 px-4 text-sm"
          >
            {busy ? "处理中…" : "共享"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        {initial.sharedTo.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {initial.sharedTo.map((s) => (
              <li key={s.userId} className="flex items-center justify-between rounded-xl bg-sky-50/70 px-3 py-2.5 text-sm">
                <span className="text-zinc-700">{s.email}</span>
                <button
                  onClick={() => revoke(s.email)}
                  className="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-50"
                >
                  撤销
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ui-card p-6">
        <h2 className="text-base font-semibold text-zinc-800">别人共享给我的日历</h2>
        {initial.sharedWithMe.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">还没有人共享日历给你</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {initial.sharedWithMe.map((s) => (
              <li key={s.userId} className="flex items-center justify-between rounded-xl bg-sky-50/70 px-3 py-2.5 text-sm">
                <span className="text-zinc-700">{s.email}</span>
                <button
                  onClick={() => revoke(s.email)}
                  className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-100"
                >
                  取消查看
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
