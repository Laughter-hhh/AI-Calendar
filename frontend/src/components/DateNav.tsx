"use client";

import { shiftDate, shiftMonth, todayStr } from "@/lib/date";

type View = "day" | "week" | "month";

export default function DateNav({
  date,
  view,
  onNavigate,
}: {
  date: string;
  view: View;
  onNavigate: (date: string, view: View) => void;
}) {
  function shift(dateStr: string, dir: number, v: View): string {
    return v === "month" ? shiftMonth(dateStr, dir) : shiftDate(dateStr, dir);
  }

  const isCurrent = view === "month" ? date.slice(0, 7) === todayStr().slice(0, 7) : date === todayStr();
  const btn =
    "shrink-0 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200 md:px-3 md:py-2 md:text-sm";
  const seg = (active: boolean) =>
    active
      ? "shrink-0 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white md:px-3 md:py-2 md:text-sm"
      : "shrink-0 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 md:px-3 md:py-2 md:text-sm";

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 text-sm">
      <button onClick={() => onNavigate(shift(date, -1, view), view)} className={btn}>
        ‹
      </button>
      <input
        type={view === "month" ? "month" : "date"}
        value={view === "month" ? date.slice(0, 7) : date}
        onChange={(e) => e.target.value && onNavigate(view === "month" ? `${e.target.value}-01` : e.target.value, view)}
        className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-1.5 py-1.5 text-xs text-zinc-700 outline-none focus:border-zinc-400 md:w-40 md:flex-none md:px-3 md:py-2 md:text-sm"
      />
      <button onClick={() => onNavigate(shift(date, 1, view), view)} className={btn}>
        ›
      </button>
      {!isCurrent && (
        <button onClick={() => onNavigate(todayStr(), view)} className={`${btn} md:px-3`} title="回到今天">
          今
        </button>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {(["day", "week", "month"] as const).map((v) => (
          <button
            key={v}
            onClick={() => onNavigate(date, v)}
            className={seg(view === v)}
            title={v === "day" ? "单日事项" : v === "week" ? "时间安排（7天时间轴）" : "月视图"}
          >
            {v === "day" ? "日" : v === "week" ? "周" : "月"}
          </button>
        ))}
      </div>
    </div>
  );
}
