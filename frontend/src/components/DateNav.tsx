"use client";

import { useRouter } from "next/navigation";
import { shiftDate, shiftMonth, todayStr } from "@/lib/date";

type View = "day" | "week" | "month";

export default function DateNav({ date, view }: { date: string; view: View }) {
  const router = useRouter();

  function go(target: string, targetView: View = view) {
    const params = new URLSearchParams();
    if (target !== todayStr() || targetView === "month") params.set("date", target);
    if (targetView !== "day") params.set("view", targetView);
    router.push(`/?${params.toString()}`);
  }

  function shift(dateStr: string, dir: number, v: View): string {
    return v === "month" ? shiftMonth(dateStr, dir) : shiftDate(dateStr, dir);
  }

  const prevLabel = view === "month" ? "‹ 上月" : "‹ 前一段";
  const nextLabel = view === "month" ? "下月 ›" : "后一段 ›";

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
      <button
        onClick={() => go(shift(date, -1, view))}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-zinc-600 hover:bg-zinc-100"
      >
        {prevLabel}
      </button>
      <input
        type={view === "month" ? "month" : "date"}
        value={view === "month" ? date.slice(0, 7) : date}
        onChange={(e) => e.target.value && go(view === "month" ? `${e.target.value}-01` : e.target.value)}
        className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-zinc-700 outline-none focus:border-zinc-400"
      />
      <button
        onClick={() => go(shift(date, 1, view))}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-zinc-600 hover:bg-zinc-100"
      >
        {nextLabel}
      </button>
      {date.slice(0, 7) !== todayStr().slice(0, 7) && (
        <button
          onClick={() => go(todayStr())}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-700"
        >
          回到今天
        </button>
      )}
      <span className="mx-1 h-4 w-px bg-zinc-200" />
      {(["day", "week", "month"] as const).map((v) => (
        <button
          key={v}
          onClick={() => go(date, v)}
          className={`rounded-lg px-3 py-1.5 ${
            view === v
              ? "bg-zinc-900 text-white"
              : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          {v === "day" ? "单日" : v === "week" ? "未来7天" : "月"}
        </button>
      ))}
    </div>
  );
}
