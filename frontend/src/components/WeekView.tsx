"use client";

import { useEffect, useState } from "react";
import type { CalendarEvent } from "@/lib/events";
import { dateLabel, shiftDate, todayStr } from "@/lib/date";
import { colorDot } from "@/lib/colors";

function repeatLabel(r: string | null): string {
  if (r === "daily") return "每天";
  if (r === "weekly") return "每周";
  if (r === "monthly") return "每月";
  return r ?? "";
}

export default function WeekView({
  initialEvents,
  startDate,
  query,
}: {
  initialEvents: CalendarEvent[];
  startDate: string;
  query: string;
}) {
  const [events, setEvents] = useState(initialEvents);

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  async function reload() {
    const res = await fetch(`/api/events?from=${startDate}&to=${shiftDate(startDate, 6)}`);
    if (res.ok) {
      const data = await res.json();
      setEvents(data.events);
    }
  }

  async function remove(ev: CalendarEvent) {
    if (ev.repeat) {
      if (!window.confirm(`只删除 ${ev.date} 这一天的日程？系列其他日期保留。`)) return;
      await fetch(`/api/events/${ev.id}?mode=single&date=${ev.date}`, { method: "DELETE" });
    } else {
      if (!window.confirm("确定删除这个日程吗？")) return;
      await fetch(`/api/events/${ev.id}`, { method: "DELETE" });
    }
    await reload();
  }

  async function toggleDone(ev: CalendarEvent) {
    await fetch(`/api/events/${ev.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !ev.done }),
    });
    await reload();
  }

  const days = Array.from({ length: 7 }, (_, i) => shiftDate(startDate, i));

  return (
    <div className="flex flex-col gap-4">
      {days.map((day) => {
        const dayEvents = events.filter(
          (e) => e.date === day && (!query || e.title.toLowerCase().includes(query.toLowerCase()))
        );
        const isToday = day === todayStr();
        return (
          <section key={day} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-700">
              {dateLabel(day)}
              {isToday && <span className="ml-2 rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-white">今天</span>}
            </h3>
            {dayEvents.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-400">暂无日程</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {dayEvents.map((ev) => (
                  <li key={`${ev.id}-${day}`} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={ev.done}
                      onChange={() => toggleDone(ev)}
                      className="h-3.5 w-3.5 shrink-0 accent-zinc-900"
                    />
                    <span className="w-12 shrink-0 text-zinc-500">{ev.startTime ?? "全天"}</span>
                    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${colorDot(ev.color)}`} />
                    <span className={`min-w-0 flex-1 truncate ${ev.done ? "text-zinc-400 line-through" : ""}`}>{ev.title}</span>
                    {ev.repeat && <span className="text-xs text-zinc-400">{repeatLabel(ev.repeat)}</span>}
                    <button
                      onClick={() => remove(ev)}
                      className="shrink-0 rounded-md px-2 py-0.5 text-xs text-red-400 hover:bg-red-50"
                    >
                      删除
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
