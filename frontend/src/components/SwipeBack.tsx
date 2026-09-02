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

      // 只响应 Next 已建立的应用内历史，避免首次打开应用时滑出到外部网站。
      if (window.history.length > 1 && window.history.state?.__NA) router.back();
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
