"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthCard() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "操作失败，请重试");
        return;
      }
      router.refresh();
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ui-card w-full max-w-sm p-7 md:p-8">
      <h2 className="text-lg font-semibold">欢迎使用 AI Calendar</h2>
      <p className="mt-1 text-sm text-zinc-500">
        {mode === "register" ? "创建账号，开始用一句话管理你的时间" : "登录后继续管理你的日程"}
      </p>

      <div className="ui-segment mt-5 grid w-full grid-cols-2 text-sm">
        {(["register", "login"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={mode === m ? "ui-segment-active" : "ui-segment-item"}
          >
            {m === "register" ? "注册" : "登录"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="ui-input w-full px-3 text-sm"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="密码（至少 6 位）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="ui-input w-full px-3 text-sm"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="ui-button-primary h-11 w-full text-sm"
        >
          {loading ? "请稍候…" : mode === "register" ? "注册并登录" : "登录"}
        </button>
      </form>
    </div>
  );
}
