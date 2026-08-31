"use client";

import { useEffect } from "react";

/** 注册离线应用壳。用户数据仍由按账号隔离的 localStorage 缓存管理。 */
export default function OfflineRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // 非 HTTPS 环境或浏览器禁用 Service Worker 时，继续使用页面内缓存能力。
    });
  }, []);

  return null;
}
