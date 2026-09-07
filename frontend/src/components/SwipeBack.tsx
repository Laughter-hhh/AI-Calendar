"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const SWIPE_DISTANCE = 72;

function isHorizontalScroller(target: HTMLElement | null): boolean {
  let current = target;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    if (
      (style.overflowX === "auto" || style.overflowX === "scroll") &&
      current.scrollWidth > current.clientWidth + 1
    ) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

/** 移动端向左滑返回上一级；表单和横向滚动控件不会触发。 */
export default function SwipeBack() {
  const router = useRouter();

  useEffect(() => {
    let start: { x: number; y: number } | null = null;

    function onTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1) {
        start = null;
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "a, input, textarea, select, button, [role=\"button\"], [contenteditable=\"true\"], [data-swipe-back-ignore]"
        ) || isHorizontalScroller(target)
      ) {
        start = null;
        return;
      }
      const touch = event.touches[0];
      start = { x: touch.clientX, y: touch.clientY };
    }

    function onTouchEnd(event: TouchEvent) {
      if (!start || event.changedTouches.length !== 1) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      start = null;
      if (dx > -SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.25) return;

      // 原生菜单链接在部分 WebView 中不会保留 Next 的 __NA 标记；
      // 同源 referrer 仍能证明这是应用内页面，允许安全返回。
      let sameOriginReferrer = false;
      try {
        sameOriginReferrer =
          document.referrer.length > 0 && new URL(document.referrer).origin === window.location.origin;
      } catch {
        sameOriginReferrer = false;
      }
      if (window.history.length > 1 && (window.history.state?.__NA || sameOriginReferrer)) router.back();
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [router]);

  return null;
}
