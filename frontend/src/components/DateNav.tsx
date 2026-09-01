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
  const btn = "ui-button-secondary h-10 min-w-10 px-3 text-sm";
  const seg = (active: boolean) => (active ? "ui-segment-active flex-1 sm:flex-none" : "ui-segment-item flex-1 sm:flex-none");

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <button onClick={() => onNavigate(shift(date, -1, view), view)} className={btn} aria-label="上一个周期">
        ‹
      </button>
      <input
        type={view === "month" ? "month" : "date"}
        value={view === "month" ? date.slice(0, 7) : date}
        onChange={(e) => e.target.value && onNavigate(view === "month" ? `${e.target.value}-01` : e.target.value, view)}
        className="ui-input h-10 min-w-0 w-full px-3 text-sm sm:w-44 sm:flex-none"
      />
      <button onClick={() => onNavigate(shift(date, 1, view), view)} className={btn} aria-label="下一个周期">
        ›
      </button>
      {!isCurrent && (
        <button onClick={() => onNavigate(todayStr(), view)} className={`${btn} px-3`} title="回到今天">
          今天
        </button>
      )}
      </div>

      <div className="ui-segment w-full sm:ml-auto sm:w-auto">
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
