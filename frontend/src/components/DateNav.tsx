"use client";

import { useRouter } from "next/navigation";
import { shiftDate, todayStr } from "@/lib/date";

export default function DateNav({ date }: { date: string }) {
  const router = useRouter();

  function go(target: string) {
    router.push(target === todayStr() ? "/" : `/?date=${target}`);
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
      <button
        onClick={() => go(shiftDate(date, -1))}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-zinc-600 hover:bg-zinc-100"
      >
        ‹ 前一天
      </button>
      <input
        type="date"
        value={date}
        onChange={(e) => e.target.value && go(e.target.value)}
        className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-zinc-700 outline-none focus:border-zinc-400"
      />
      <button
        onClick={() => go(shiftDate(date, 1))}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-zinc-600 hover:bg-zinc-100"
      >
        后一天 ›
      </button>
      {date !== todayStr() && (
        <button
          onClick={() => go(todayStr())}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-700"
        >
          回到今天
        </button>
      )}
    </div>
  );
}
