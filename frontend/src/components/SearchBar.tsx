"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchBar({ query }: { query: string }) {
  const router = useRouter();
  const [value, setValue] = useState(query);

  function apply(q: string) {
    const params = new URLSearchParams(window.location.search);
    if (q) params.set("q", q);
    else params.delete("q");
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="mb-3 flex items-center gap-2 text-sm">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && apply(value.trim())}
        placeholder="搜索日程标题…"
        className="w-full max-w-xs rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-zinc-700 outline-none focus:border-zinc-400"
      />
      <button
        onClick={() => apply(value.trim())}
        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-700"
      >
        搜索
      </button>
      {query && (
        <button
          onClick={() => {
            setValue("");
            apply("");
          }}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-zinc-500 hover:bg-zinc-100"
        >
          清除
        </button>
      )}
    </div>
  );
}
