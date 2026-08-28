"use client";

import { useEffect, useMemo, useState } from "react";
import type { CalendarEvent } from "@/lib/events";
import { dateLabel, shiftDate, todayStr } from "@/lib/date";

// 时间安排视图：连续 7 天 × 时间块（6:00 - 23:00）
const START_HOUR = 6;
const HOURS = Array.from({ length: 18 }, (_, i) => i + START_HOUR);
const ROW_H = 44;
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const BLOCK_COLORS: Record<string, string> = {
  red: "bg-red-400/80 border-red-500",
  orange: "bg-orange-400/80 border-orange-500",
  green: "bg-emerald-400/80 border-emerald-500",
  blue: "bg-blue-400/80 border-blue-500",
  purple: "bg-violet-400/80 border-violet-500",
};

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

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
  const [events, setEvents] = useState(initialEvents);
  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => shiftDate(startDate, i)),
    [startDate]
  );
  const today = todayStr();
  const visible = events.filter((e) => matchesQuery(e, query));

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
              {byDay(d)
                .filter((e) => e.startTime)
                .map((ev) => {
                  const top = ((toMinutes(ev.startTime!) - START_HOUR * 60) / 60) * ROW_H;
                  const dur = ev.endTime
                    ? Math.max(30, toMinutes(ev.endTime) - toMinutes(ev.startTime!))
                    : 60;
                  const height = (dur / 60) * ROW_H;
                  const cls = BLOCK_COLORS[ev.color ?? ""] ?? "bg-zinc-200 border-zinc-300";
                  return (
                    <button
                      key={`${ev.id}-${d}`}
                      className={`absolute left-0.5 right-0.5 overflow-hidden rounded border px-0.5 text-left ${cls} ${
                        ev.done ? "opacity-40" : ""
                      }`}
                      style={{ top, height }}
                      title={`${ev.startTime} ${ev.title}`}
                    >
                      <span className="block truncate text-[10px] font-medium leading-tight text-zinc-800">
                        {`${ev.startTime} ${ev.title}`}
                      </span>
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
