"use client";

import { useRouter } from "next/navigation";
import { clearOfflineUserId } from "@/lib/offline";

export default function AuthBar({ email }: { email: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearOfflineUserId();
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <span className="max-w-[10rem] truncate text-sm text-zinc-500">{email}</span>
      <button
        onClick={logout}
        className="ui-button-secondary h-10 px-3 text-sm"
      >
        退出
      </button>
    </div>
  );
}
