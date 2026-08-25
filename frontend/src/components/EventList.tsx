"use client";

import { useEffect, useState } from "react";
import type { CalendarEvent } from "@/lib/events";

function repeatLabel(r: string): string {
  if (r === "daily") return "每天";
  if (r === "weekly") return "每周";
  if (r === "monthly") return "每月";
  return r;
}

export default function EventList({
  initialEvents,
  date,
  isToday,
}: {
  initialEvents: CalendarEvent[];
  date: string;
  isToday: boolean;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState({ title: "", time: "" });

  // 关键：服务端刷新后传入新的 initialEvents 时，同步本地列表
  // （否则保存日程后列表不会更新，表现为"添加了但看不到"）
  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  async function refresh() {
    const res = await fetch(`/api/events?date=${date}`);
    if (res.ok) {
      const data = await res.json();
      setEvents(data.events);
    }
  }

  async function remove(id: number) {
    if (!window.confirm("确定删除这个日程吗？")) return;
    await fetch(`/api/events/${id}`, { method: "DELETE" });
    await refresh();
  }

  function startEdit(ev: CalendarEvent) {
    setEditingId(ev.id);
    setDraft({ title: ev.title, time: ev.startTime ?? "" });
  }

  async function saveEdit(id: number) {
    await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: draft.title || undefined, time: draft.time || null }),
    });
    setEditingId(null);
    await refresh();
  }

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-8 text-center">
        <p className="text-sm text-zinc-500">{isToday ? "今天还没有日程" : "这一天还没有日程"}</p>
        <p className="mt-1 text-sm text-zinc-400">试试告诉 AI："明天下午三点开会"</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {events.map((ev) => (
        <li key={ev.id} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
          {editingId === ev.id ? (
            <div className="flex flex-col gap-2">
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="标题"
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-zinc-400"
              />
              <input
                value={draft.time}
                onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                placeholder="时间，如 15:00（留空为全天）"
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-zinc-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => saveEdit(ev.id)}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700"
                >
                  保存
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-14 shrink-0 text-sm font-medium text-zinc-700">
                {ev.startTime ?? "全天"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{ev.title}</p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-400">
                  {ev.endTime && <span>至 {ev.endTime}</span>}
                  {ev.repeat && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-500">
                      {repeatLabel(ev.repeat)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => startEdit(ev)}
                  className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
                >
                  编辑
                </button>
                <button
                  onClick={() => remove(ev.id)}
                  className="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-50"
                >
                  删除
                </button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
