"use client";

import { useEffect } from "react";

export const FONT_SIZE_KEY = "aical:font-size";
export type FontSize = "small" | "standard" | "large";

export function applyFontSize(value: FontSize): void {
  document.documentElement.dataset.fontSize = value;
}

export default function FontSizeRuntime() {
  useEffect(() => {
    try {
      const value = localStorage.getItem(FONT_SIZE_KEY);
      if (value === "small" || value === "standard" || value === "large") applyFontSize(value);
    } catch {
      // 本地存储不可用时使用标准字号。
    }
  }, []);

  return null;
}
