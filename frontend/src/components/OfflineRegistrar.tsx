"use client";

import { useEffect } from "react";
import { flushMutationQueue } from "@/lib/offline";

/** 注册离线应用壳。用户数据仍由按账号隔离的 localStorage 缓存管理。 */
export default function OfflineRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // 非 HTTPS 环境或浏览器禁用 Service Worker 时，继续使用页面内缓存能力。
      });
    }

    // 不阻塞首屏导航：笔记、设置等页面先完成渲染，空闲后再尝试同步待提交操作。
    const initialSync = window.setTimeout(() => void flushMutationQueue(), 1200);
    const onOnline = () => void flushMutationQueue();
    window.addEventListener("online", onOnline);
    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}
