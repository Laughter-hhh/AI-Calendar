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
        className="ui-input h-10 min-w-0 flex-1 px-3 text-sm"
      />
      <button
        onClick={() => onSearch(value.trim())}
        className="ui-button-primary h-10 shrink-0 px-4 text-sm"
      >
        搜索
      </button>
      {query && (
        <button
          onClick={() => {
            setValue("");
            onSearch("");
          }}
          className="ui-button-secondary h-10 shrink-0 px-3 text-sm"
        >
          清除
        </button>
      )}
    </div>
  );
}
