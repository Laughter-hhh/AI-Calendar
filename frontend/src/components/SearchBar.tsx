"use client";

import { useState } from "react";

export default function SearchBar({
  query,
  onSearch,
}: {
  query: string;
  onSearch: (q: string) => void;
}) {
  const [value, setValue] = useState(query);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSearch(value.trim())}
        placeholder="搜索日程标题…"
        className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 outline-none focus:border-zinc-400 md:px-3 md:py-2 md:text-sm"
      />
      <button
        onClick={() => onSearch(value.trim())}
        className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-white hover:bg-zinc-700 md:px-4 md:py-2 md:text-sm"
      >
        搜索
      </button>
      {query && (
        <button
          onClick={() => {
            setValue("");
            onSearch("");
          }}
          className="shrink-0 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100"
        >
          清除
        </button>
      )}
    </div>
  );
}
