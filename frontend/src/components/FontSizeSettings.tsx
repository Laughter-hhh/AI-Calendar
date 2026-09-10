"use client";

import { useEffect, useState } from "react";
import { applyFontSize, FONT_SIZE_KEY, type FontSize } from "./FontSizeRuntime";

const OPTIONS: Array<{ value: FontSize; label: string; hint: string }> = [
  { value: "small", label: "小", hint: "更紧凑" },
  { value: "standard", label: "标准", hint: "推荐" },
  { value: "large", label: "大", hint: "更易读" },
];

export default function FontSizeSettings() {
  const [value, setValue] = useState<FontSize>("standard");

  useEffect(() => {
    let frame = 0;
    try {
      const saved = localStorage.getItem(FONT_SIZE_KEY);
      if (saved === "small" || saved === "standard" || saved === "large") {
        applyFontSize(saved);
        frame = window.requestAnimationFrame(() => setValue(saved));
      }
    } catch {
      // 本地存储不可用时使用标准字号。
    }
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  function select(next: FontSize) {
    setValue(next);
    applyFontSize(next);
    try {
      localStorage.setItem(FONT_SIZE_KEY, next);
    } catch {
      // 当前页面仍会立即应用选择。
    }
  }

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-zinc-600">字体大小</p>
      <div className="mt-2 flex max-w-sm gap-1.5 rounded-xl bg-sky-50 p-1" role="radiogroup" aria-label="字体大小">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => select(option.value)}
            className={value === option.value ? "ui-segment-active min-w-0 flex-1 px-2 py-1.5 text-xs" : "ui-segment-item min-w-0 flex-1 px-2 py-1.5 text-xs"}
          >
            <span>{option.label}</span><span className="ml-1 text-[10px] opacity-70">{option.hint}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-5 text-zinc-500">字号会在本机保存；大字号在手机上会自动限幅，尽量保留时间线和按钮空间。</p>
    </div>
  );
}
