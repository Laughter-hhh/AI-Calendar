"use client";

import { useRouter } from "next/navigation";

export default function AuthBar({ email }: { email: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <span className="max-w-[10rem] truncate text-sm text-zinc-500">{email}</span>
      <button
        onClick={logout}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100"
      >
        退出
      </button>
    </div>
  );
}
