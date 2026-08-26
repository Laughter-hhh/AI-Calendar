"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarEvent } from "@/lib/events";
import { shiftDate, shiftMonth, todayStr } from "@/lib/date";
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
}: {
  initialEvents: CalendarEvent[];
  startDate: string;
  query: string;
}) {
  const router = useRouter();
  // 单一数据源：当前月份完全由 URL 的 startDate 决定（修复"选月份跳不过去"的 bug）
  const month = monthStartOf(startDate);
  const [events, setEvents] = useState(initialEvents);

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  useEffect(() => {
    const from = month;
    const to = shiftDate(`${month.slice(0, 7)}-${daysInMonth(month)}`, 0);
    fetch(`/api/events?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => {});
  }, [month]);

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      if (!matchesQuery(ev, query)) continue;
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
    }
    return map;
  }, [events, query]);

  function goMonth(targetMonth: string) {
    router.push(`/?date=${targetMonth}&view=month`);
  }

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
    <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{month}</h3>
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => goMonth(shiftMonth(month, -1))}
            className="rounded-md border border-zinc-200 px-2 py-1 text-zinc-600 hover:bg-zinc-100"
          >
            上月
          </button>
          <button
            onClick={() => goMonth(monthStartOf(today))}
            className="rounded-md bg-zinc-900 px-2 py-1 text-white hover:bg-zinc-700"
          >
            今天
          </button>
          <button
            onClick={() => goMonth(shiftMonth(month, 1))}
            className="rounded-md border border-zinc-200 px-2 py-1 text-zinc-600 hover:bg-zinc-100"
          >
            下月
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-zinc-200 text-center">
        {weekdays.map((w) => (
          <div key={w} className="bg-zinc-50 py-1 text-xs text-zinc-400">
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
              onClick={() => router.push(`/?date=${day}`)}
              className={`flex min-h-[4.5rem] flex-col items-stretch gap-0.5 bg-white p-1 text-left align-top hover:bg-zinc-50 ${
                isToday ? "bg-zinc-100" : ""
              }`}
            >
              <span className={`text-xs ${isToday ? "font-bold text-zinc-900" : "text-zinc-600"}`}>
                {Number(day.slice(8, 10))}
              </span>
              {dayEvents.slice(0, 3).map((ev) => (
                <span key={`${ev.id}-${day}`} className="truncate rounded bg-zinc-100 px-1 py-0.5 text-[11px] text-zinc-600">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${colorDot(ev.color)}`} />{" "}
                  {ev.startTime ? `${ev.startTime} ${ev.title}` : `全天 ${ev.title}`}
                </span>
              ))}
              {dayEvents.length > 3 && (
                <span className="px-1 text-[11px] text-zinc-400">+{dayEvents.length - 3}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
