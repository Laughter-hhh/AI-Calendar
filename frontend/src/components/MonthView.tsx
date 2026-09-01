"use client";

import { useMemo } from "react";
import type { CalendarEvent } from "@/lib/events";
import { shiftMonth, todayStr } from "@/lib/date";
import { colorDot } from "@/lib/colors";

function monthStartOf(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

function daysInMonth(dateStr: string): number {
  const [y, m] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function weekdayOfMonthStart(dateStr: string): number {
  return new Date(`${monthStartOf(dateStr)}T00:00:00Z`).getUTCDay();
}

function matchesQuery(ev: CalendarEvent, q: string): boolean {
  return !q || ev.title.toLowerCase().includes(q.toLowerCase());
}

export default function MonthView({
  initialEvents,
  startDate,
  query,
  onMonthChange,
  onSelectDay,
}: {
  initialEvents: CalendarEvent[];
  startDate: string;
  query: string;
  onMonthChange: (monthDate: string) => void;
  onSelectDay: (day: string) => void;
}) {
  // 单一数据源：当前月份完全由 startDate（URL/父组件）决定，不做内部导航与请求
  const month = monthStartOf(startDate);
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of initialEvents) {
      if (!matchesQuery(ev, query)) continue;
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
    }
    return map;
  }, [initialEvents, query]);

  const total = daysInMonth(month);
  const lead = weekdayOfMonthStart(month);
  const cells: Array<string | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => `${month.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const today = todayStr();

  return (
    <div className="ui-card p-3 md:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{month}</h3>
        <div className="flex gap-1.5 text-xs">
          <button
            onClick={() => onMonthChange(shiftMonth(month, -1))}
            className="ui-button-secondary h-9 px-3 text-xs"
          >
            上月
          </button>
          <button
            onClick={() => onMonthChange(monthStartOf(today))}
            className="ui-button-primary h-9 px-3 text-xs"
          >
            今天
          </button>
          <button
            onClick={() => onMonthChange(shiftMonth(month, 1))}
            className="ui-button-secondary h-9 px-3 text-xs"
          >
            下月
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-sky-100 text-center">
        {weekdays.map((w) => (
          <div key={w} className="bg-sky-50 py-2 text-xs font-medium text-sky-700/70">
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="bg-white p-1" />;
          const dayEvents = grouped.get(day) ?? [];
          const isToday = day === today;
          return (
            <button
              key={day}
              onClick={() => onSelectDay(day)}
              className={`flex min-h-[4.6rem] flex-col items-stretch gap-1 bg-white p-1 text-left align-top hover:bg-sky-50 md:min-h-[7.2rem] ${
                isToday ? "bg-amber-50" : ""
              }`}
            >
              <span className={`px-0.5 text-xs ${isToday ? "font-bold text-zinc-900" : "text-zinc-600"}`}>
                {Number(day.slice(8, 10))}
              </span>
              {dayEvents.slice(0, 4).map((ev, index) => (
                <span
                  key={`${ev.id}-${day}`}
                  className={`truncate rounded bg-zinc-100 px-0.5 py-px text-[10px] leading-3 md:text-xs ${
                    index >= 2 ? "hidden md:block" : ""
                  } ${
                    ev.done ? "text-zinc-400 line-through" : "text-zinc-600"
                  }`}
                >
                  {ev.done && "✓ "}
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${colorDot(ev.color)}`} />{" "}
                  {ev.startTime ? `${ev.startTime} ${ev.title}` : `待办 ${ev.title}`}
                </span>
              ))}
              {dayEvents.length > 2 && (
                <span className="px-0.5 text-[10px] text-zinc-400 md:hidden">+{dayEvents.length - 2}</span>
              )}
              {dayEvents.length > 4 && (
                <span className="hidden px-0.5 text-[10px] text-zinc-400 md:block">+{dayEvents.length - 4}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
