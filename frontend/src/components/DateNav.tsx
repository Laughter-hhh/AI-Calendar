"use client";

import { shiftDate, shiftMonth, todayStr } from "@/lib/date";

type View = "day" | "week" | "month";

export function ViewSwitcher({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  const seg = (active: boolean) => (active ? "ui-segment-active ui-segment-compact-item" : "ui-segment-item ui-segment-compact-item");
  return (
    <div className="ui-segment ui-segment-compact shrink-0" aria-label="日周月视图">
      {(["day", "week", "month"] as const).map((nextView) => (
        <button
          key={nextView}
          onClick={() => onChange(nextView)}
          className={seg(view === nextView)}
          title={nextView === "day" ? "单日事项" : nextView === "week" ? "时间安排（7天时间轴）" : "月视图"}
        >
          {nextView === "day" ? "日" : nextView === "week" ? "周" : "月"}
        </button>
      ))}
    </div>
  );
}

export default function DateNav({
  date,
  view,
  onNavigate,
  showView = true,
}: {
  date: string;
  view: View;
  onNavigate: (date: string, view: View) => void;
  showView?: boolean;
}) {
  function shift(dateStr: string, dir: number, v: View): string {
    return v === "month" ? shiftMonth(dateStr, dir) : shiftDate(dateStr, dir);
  }

  const isCurrent = view === "month" ? date.slice(0, 7) === todayStr().slice(0, 7) : date === todayStr();
  // 日期切换按钮在窄屏上不得被压缩换行，日期输入框会优先收缩。
  const btn = "ui-button-secondary ui-button-compact min-w-8 shrink-0 whitespace-nowrap px-2 text-sm";
  return (
    <div className={`${showView ? "mb-2" : "mb-0"} flex flex-wrap items-center gap-1.5 text-sm`}>
      <div className="flex min-w-0 flex-1 items-center gap-1">
      <button onClick={() => onNavigate(shift(date, -1, view), view)} className={btn} aria-label="上一个周期">
        ‹
      </button>
      <input
        type={view === "month" ? "month" : "date"}
        value={view === "month" ? date.slice(0, 7) : date}
        onChange={(e) => e.target.value && onNavigate(view === "month" ? `${e.target.value}-01` : e.target.value, view)}
        className="ui-input ui-input-compact min-w-0 w-full px-2 text-sm sm:w-40 sm:flex-none"
      />
      <button onClick={() => onNavigate(shift(date, 1, view), view)} className={btn} aria-label="下一个周期">
        ›
      </button>
      {!isCurrent && (
        <button onClick={() => onNavigate(todayStr(), view)} className={`${btn} px-2`} title="回到今天">
          今天
        </button>
      )}
      </div>

      {showView && <ViewSwitcher view={view} onChange={(nextView) => onNavigate(date, nextView)} />}
    </div>
  );
}
