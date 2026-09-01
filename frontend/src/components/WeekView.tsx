"use client";

import { useMemo } from "react";
import type { CalendarEvent } from "@/lib/events";
import { dateLabel, shiftDate, todayStr } from "@/lib/date";
import { layoutOverlappingEvents } from "@/lib/timeline";

// 时间安排视图：默认显示 06:00 - 24:00；存在凌晨日程时自动向前扩展。
const DEFAULT_START_HOUR = 6;
const END_HOUR = 24;
const ROW_H = 44;
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const BLOCK_COLORS: Record<string, string> = {
  red: "bg-red-500/90 border-red-600 text-white",
  orange: "bg-orange-500/90 border-orange-600 text-white",
  amber: "bg-amber-500/90 border-amber-600 text-white",
  green: "bg-green-500/90 border-green-600 text-white",
  blue: "bg-sky-500/90 border-sky-600 text-white",
  purple: "bg-violet-500/90 border-violet-600 text-white",
  pink: "bg-pink-500/90 border-pink-600 text-white",
};

function shortLabel(d: string): string {
  const label = dateLabel(d);
  return label.split(" ")[0];
}

function matchesQuery(ev: CalendarEvent, q: string): boolean {
  return !q || ev.title.toLowerCase().includes(q.toLowerCase());
}

export default function WeekView({
  initialEvents,
  startDate,
  query,
  onSelectDay,
}: {
  initialEvents: CalendarEvent[];
  startDate: string;
  query: string;
  onSelectDay: (day: string) => void;
}) {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => shiftDate(startDate, i)),
    [startDate]
  );
  const today = todayStr();
  const visible = initialEvents.filter((e) => matchesQuery(e, query));

  const byDay = (day: string) => visible.filter((e) => e.date === day);
  const layoutsByDay = new Map(
    days.map((day) => [day, layoutOverlappingEvents(byDay(day).filter((event) => event.startTime))])
  );
  const allLayouts = [...layoutsByDay.values()].flat();
  const earliestMinutes =
    allLayouts.length > 0
      ? Math.min(...allLayouts.map((item) => item.startMinutes))
      : DEFAULT_START_HOUR * 60;
  const startHour = Math.max(0, Math.min(DEFAULT_START_HOUR, Math.floor(earliestMinutes / 60)));
  const hourLines = Array.from({ length: END_HOUR - startHour + 1 }, (_, index) => startHour + index);
  const timelineHeight = (END_HOUR - startHour) * ROW_H;

  return (
    <div className="overflow-x-auto rounded-2xl border border-sky-100 bg-white/90 shadow-[0_12px_30px_rgba(30,64,175,0.08)]">
      <div className="min-w-[660px]" data-timeline-start-hour={startHour}>
        {/* 日期头 */}
        <div className="flex border-b border-sky-100">
          <div className="w-12 shrink-0" />
          {days.map((d) => (
            <button
              key={d}
              onClick={() => onSelectDay(d)}
              className={`flex-1 border-l border-sky-100 py-2.5 text-center hover:bg-sky-50 ${
                d === today ? "bg-amber-50" : ""
              }`}
            >
              <div className="text-[11px] text-sky-700/60">{shortLabel(d)}</div>
              <div className={`text-xs ${d === today ? "font-bold text-amber-800" : "text-sky-900/70"}`}>
                {`周${WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()]}`}
              </div>
            </button>
          ))}
        </div>

        {/* 全天/待办 */}
        <div className="flex border-b border-sky-100 bg-sky-50/65">
          <div className="w-12 shrink-0" />
          {days.map((d) => {
            const todos = byDay(d).filter((e) => !e.startTime);
            return (
              <div key={d} className="min-h-9 flex-1 border-l border-sky-100 px-1 py-1">
                {todos.slice(0, 3).map((ev) => (
                  <span
                    key={`${ev.id}-${d}`}
                    className={`block truncate rounded px-0.5 text-[10px] leading-4 ${
                      ev.done ? "text-zinc-400 line-through" : "text-zinc-600"
                    }`}
                    title={ev.title}
                  >
                    ☑ {ev.title}
                  </span>
                ))}
                {todos.length > 3 && (
                  <span className="block px-0.5 text-[10px] text-zinc-400">+{todos.length - 3}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* 时间网格 */}
        <div className="flex">
          <div className="w-12 shrink-0">
            {hourLines.slice(0, -1).map((h) => (
              <div
                key={h}
                style={{ height: ROW_H }}
                className="-translate-y-1.5 pr-1 text-right text-[10px] text-zinc-400"
              >
                {`${h}:00`}
              </div>
            ))}
          </div>
          {days.map((d) => (
            <div
              key={d}
              className="relative flex-1 border-l border-sky-100"
              style={{ height: timelineHeight }}
            >
              {hourLines.map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-sky-50"
                  style={{ top: (h - startHour) * ROW_H }}
                />
              ))}
              {(layoutsByDay.get(d) ?? []).map(
                ({ event: ev, startMinutes, endMinutes, column, columnCount }) => {
                  const top = ((startMinutes - startHour * 60) / 60) * ROW_H;
                  const height = Math.max(16, ((endMinutes - startMinutes) / 60) * ROW_H);
                  const cls =
                    BLOCK_COLORS[ev.color ?? ""] ?? "bg-zinc-200 border-zinc-300 text-zinc-800";
                  const width = 100 / columnCount;
                  return (
                    <button
                      key={`${ev.id}-${d}`}
                      onClick={() => onSelectDay(d)}
                      data-timeline-column={column}
                      data-timeline-columns={columnCount}
                      className={`absolute overflow-hidden rounded border px-0.5 text-left ${cls} ${
                        ev.done ? "opacity-40" : ""
                      }`}
                      style={{
                        top,
                        height,
                        left: `calc(${column * width}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                      }}
                      title={`${ev.startTime} ${ev.title}`}
                    >
                      <span className="block truncate text-[10px] font-medium leading-tight">
                        {`${ev.startTime} ${ev.title}`}
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
