"use client";

import { useEffect, useState } from "react";
import { APP_VERSION } from "@/lib/version";

export default function VersionChecker() {
  const [latest, setLatest] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const data = await res.json();
        if (data.version && data.version !== APP_VERSION) setLatest(data.version);
      } catch {
        // 网络异常忽略，下轮再试
      }
    }
    check();
    const timer = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  if (!latest) return null;

  return (
    <div className="fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
      <span>发现新版本 v{latest}</span>
      <button
        onClick={() => window.location.reload()}
        className="rounded-full bg-white px-3 py-0.5 text-xs font-medium text-zinc-900 hover:bg-zinc-100"
      >
        立即刷新
      </button>
    </div>
  );
}
