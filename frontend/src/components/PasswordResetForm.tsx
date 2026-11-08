"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PasswordResetForm() {
  const [token] = useState(() =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.hash.slice(1)).get("token") ?? ""
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!token) { setError("重置链接缺少令牌，请重新申请。"); return; }
    if (password.length < 8) { setError("新密码至少需要 8 个字符。"); return; }
    if (password !== confirm) { setError("两次输入的密码不一致。"); return; }

    setBusy(true);
    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "无法重置密码，请重新申请链接。"); return; }
      setMessage(data.message ?? "密码已重置，请返回登录。");
      setPassword("");
      setConfirm("");
    } catch {
      setError("网络错误，请重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4 py-10">
      <section className="ui-card w-full p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-slate-800">设置新密码</h1>
        <p className="mt-2 text-sm text-slate-500">重置链接 30 分钟有效且只能使用一次。重置后，其他设备需要重新登录。</p>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="新密码（至少 8 个字符）"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="ui-input w-full px-3 text-sm"
          />
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="再次输入新密码"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="ui-input w-full px-3 text-sm"
          />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
          <button disabled={busy || Boolean(message)} className="ui-button-primary mt-2 h-11 w-full text-sm">
            {busy ? "正在重置…" : "重置密码"}
          </button>
        </form>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-sky-700 hover:underline">返回登录</Link>
      </section>
    </main>
  );
}
