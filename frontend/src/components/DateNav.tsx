"use client";

import { useRouter } from "next/navigation";
import { shiftDate, todayStr } from "@/lib/date";

export default function DateNav({ date, view }: { date: string; view: "day" | "week" }) {
  const router = useRouter();

  function go(target: string, targetView: "day" | "week" = view) {
    const params = new URLSearchParams();
    if (target !== todayStr()) params.set("date", target);
    if (targetView === "week") params.set("view", "week");
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
      <button
        onClick={() => go(shiftDate(date, -1))}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-zinc-600 hover:bg-zinc-100"
      >
        ‹ 前一段
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
        后一段 ›
      </button>
      {date !== todayStr() && (
        <button
          onClick={() => go(todayStr())}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-700"
        >
          回到今天
        </button>
      )}
      <span className="mx-1 h-4 w-px bg-zinc-200" />
      <button
        onClick={() => go(date, "day")}
        className={`rounded-lg px-3 py-1.5 ${view === "day" ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100"}`}
      >
        单日
      </button>
      <button
        onClick={() => go(date, "week")}
        className={`rounded-lg px-3 py-1.5 ${view === "week" ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100"}`}
      >
        未来7天
      </button>
    </div>
  );
}
