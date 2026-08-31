"use client";

import { useMemo } from "react";
import type { CalendarEvent } from "@/lib/events";
import { dateLabel, shiftDate, todayStr } from "@/lib/date";
import { layoutOverlappingEvents } from "@/lib/timeline";

// 时间安排视图：连续 7 天 × 时间块（6:00 - 23:00）
const START_HOUR = 6;
const HOURS = Array.from({ length: 18 }, (_, i) => i + START_HOUR);
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

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="min-w-[660px]">
        {/* 日期头 */}
        <div className="flex border-b border-zinc-200">
          <div className="w-12 shrink-0" />
          {days.map((d) => (
            <button
              key={d}
              onClick={() => onSelectDay(d)}
              className={`flex-1 border-l border-zinc-100 py-1.5 text-center hover:bg-zinc-50 ${
                d === today ? "bg-zinc-100" : ""
              }`}
            >
              <div className="text-[11px] text-zinc-400">{shortLabel(d)}</div>
              <div className={`text-xs ${d === today ? "font-bold text-zinc-900" : "text-zinc-600"}`}>
                {`周${WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()]}`}
              </div>
            </button>
          ))}
        </div>

        {/* 全天/待办 */}
        <div className="flex border-b border-zinc-100 bg-zinc-50/60">
          <div className="w-12 shrink-0" />
          {days.map((d) => {
            const todos = byDay(d).filter((e) => !e.startTime);
            return (
              <div key={d} className="min-h-7 flex-1 border-l border-zinc-100 px-0.5 py-0.5">
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
            {HOURS.map((h) => (
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
              className="relative flex-1 border-l border-zinc-100"
              style={{ height: HOURS.length * ROW_H }}
            >
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-zinc-50"
                  style={{ top: (h - START_HOUR) * ROW_H, height: ROW_H }}
                />
              ))}
              {layoutOverlappingEvents(byDay(d).filter((e) => e.startTime)).map(
                ({ event: ev, startMinutes, endMinutes, column, columnCount }) => {
                  const top = ((startMinutes - START_HOUR * 60) / 60) * ROW_H;
                  const height = ((endMinutes - startMinutes) / 60) * ROW_H;
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
