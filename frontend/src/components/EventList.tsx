"use client";

import { useEffect, useState } from "react";
import type { CalendarEvent } from "@/lib/events";
import { EVENT_COLORS, colorDot } from "@/lib/colors";

function repeatLabel(r: string): string {
  if (r === "daily") return "每天";
  if (r === "weekly") return "每周";
  if (r === "monthly") return "每月";
  return r;
}

interface Draft {
  title: string;
  date: string;
  time: string;
  endTime: string;
  note: string;
  color: string;
}

export default function EventList({
  initialEvents,
  date,
  isToday,
  query,
}: {
  initialEvents: CalendarEvent[];
  date: string;
  isToday: boolean;
  query: string;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>({ title: "", date: "", time: "", endTime: "", note: "", color: "" });

  // 关键：服务端刷新后传入新的 initialEvents 时，同步本地列表
  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  const visible = events.filter(
    (e) => !query || e.title.toLowerCase().includes(query.toLowerCase())
  );

  async function refresh() {
    const res = await fetch(`/api/events?date=${date}`);
    if (res.ok) {
      const data = await res.json();
      setEvents(data.events);
    }
  }

  async function removeSeries(ev: CalendarEvent) {
    const tip = ev.repeat ? "这会把整个重复系列都删除，确定吗？" : "确定删除这个日程吗？";
    if (!window.confirm(tip)) return;
    await fetch(`/api/events/${ev.id}`, { method: "DELETE" });
    await refresh();
  }

  async function removeSingle(ev: CalendarEvent) {
    if (!window.confirm(`只删除 ${ev.date} 这一天的日程？系列其他日期保留。`)) return;
    await fetch(`/api/events/${ev.id}?mode=single&date=${ev.date}`, { method: "DELETE" });
    await refresh();
  }

  async function toggleDone(ev: CalendarEvent) {
    await fetch(`/api/events/${ev.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !ev.done }),
    });
    await refresh();
  }

  function startEdit(ev: CalendarEvent) {
    setEditingId(ev.id);
    setDetailId(null);
    setDraft({
      title: ev.title,
      date: ev.date,
      time: ev.startTime ?? "",
      endTime: ev.endTime ?? "",
      note: ev.note ?? "",
      color: ev.color ?? "",
    });
  }

  async function saveEdit(id: number) {
    await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title || undefined,
        date: draft.date || undefined,
        time: draft.time || null,
        endTime: draft.endTime || null,
        note: draft.note || null,
        color: draft.color || null,
      }),
    });
    setEditingId(null);
    await refresh();
  }

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-8 text-center">
        <p className="text-sm text-zinc-500">
          {query
            ? "没有匹配的日程"
            : isToday
              ? "今天还没有日程"
              : "这一天还没有日程"}
        </p>
        <p className="mt-1 text-sm text-zinc-400">试试告诉 AI："明天下午三点开会"</p>
      </div>
    );
  }

  const timed = visible.filter((e) => e.startTime !== null);
  const todos = visible.filter((e) => e.startTime === null);

  const renderItem = (ev: CalendarEvent) => (
        <li key={ev.id} className="rounded-xl border border-zinc-200 bg-white p-2.5 shadow-sm md:p-4">
          {editingId === ev.id ? (
            <div className="flex flex-col gap-2">
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="标题"
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-zinc-400"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-zinc-400"
                />
                <input
                  value={draft.time}
                  onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                  placeholder="开始时间，如 15:00（留空为全天）"
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-zinc-400"
                />
              </div>
              <input
                value={draft.endTime}
                onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
                placeholder="结束时间（可选），如 16:00"
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-zinc-400"
              />
              <input
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                placeholder="备注（可选）"
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-zinc-400"
              />
              <select
                value={draft.color}
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-400"
              >
                {EVENT_COLORS.map((c) => (
                  <option key={c.value} value={c.value}>
                    颜色：{c.label}
                  </option>
                ))}
              </select>
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
            <div>
              <div className="flex items-center gap-3">
                {!ev.ownerEmail && (
                  <input
                    type="checkbox"
                    checked={ev.done}
                    onChange={() => toggleDone(ev)}
                    onClick={(e) => e.stopPropagation()}
                    title={ev.done ? "标记为未完成" : "标记为完成"}
                    className="h-4 w-4 shrink-0 accent-zinc-900"
                  />
                )}
                <button
                  onClick={() => setDetailId(detailId === ev.id ? null : ev.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className={`w-12 shrink-0 text-sm font-medium md:w-16 ${ev.done ? "text-zinc-300 line-through" : "text-zinc-700"}`}>
                    {ev.startTime ?? "全天"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`flex items-center gap-1.5 truncate text-sm font-medium md:text-base ${ev.done ? "text-zinc-400 line-through" : ""}`}>
                      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${colorDot(ev.color)}`} />
                      <span className="truncate">{ev.title}</span>
                    </p>
                    {ev.note && (
                      <p className={`mt-0.5 truncate text-xs ${ev.done ? "text-zinc-300 line-through" : "text-zinc-400"}`}>{ev.note}</p>
                    )}
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-400">
                      {ev.endTime && <span>至 {ev.endTime}</span>}
                      {ev.repeat && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-500">
                          {repeatLabel(ev.repeat)}
                        </span>
                      )}
                      {ev.repeatUntil && <span>至 {ev.repeatUntil}</span>}
                      {ev.ownerEmail && (
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-500">
                          来自 {ev.ownerEmail}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                {!ev.ownerEmail && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => startEdit(ev)}
                      className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
                    >
                      编辑
                    </button>
                    {ev.repeat ? (
                      <>
                        <button
                          onClick={() => removeSingle(ev)}
                          className="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-50"
                        >
                          删此日
                        </button>
                        <button
                          onClick={() => removeSeries(ev)}
                          className="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-50"
                        >
                          删系列
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => removeSeries(ev)}
                        className="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-50"
                      >
                        删除
                      </button>
                    )}
                  </div>
                )}
              </div>

              {detailId === ev.id && (
                <div className="mt-2 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">
                  <p>状态：{ev.done ? "已完成 ✅" : "未完成"}</p>
                  <p>
                    日期：{ev.date}
                    {ev.startTime ? ` ${ev.startTime}` : " 全天"}
                    {ev.endTime ? ` - ${ev.endTime}` : ""}
                  </p>
                  {ev.repeat && <p>重复：{repeatLabel(ev.repeat)}{ev.repeatUntil ? `，至 ${ev.repeatUntil}` : ""}</p>}
                  {ev.note && <p>备注：{ev.note}</p>}
                  {ev.ownerEmail && <p>来源：{ev.ownerEmail} 共享（只读）</p>}
                  {ev.sourceText && <p className="text-zinc-400">原始说法：{ev.sourceText}</p>}
                </div>
              )}
            </div>
          )}
        </li>
  );

  return (
    <div className="flex flex-col gap-4">
      {timed.length > 0 && (
        <section>
          {todos.length > 0 && <h3 className="mb-2 text-xs font-semibold text-zinc-400">⏰ 定时日程</h3>}
          <ul className="flex flex-col gap-2">{timed.map(renderItem)}</ul>
        </section>
      )}
      {todos.length > 0 && (
        <section>
          {timed.length > 0 && <h3 className="mb-2 text-xs font-semibold text-zinc-400">☑ 待办事项</h3>}
          <ul className="flex flex-col gap-2">{todos.map(renderItem)}</ul>
        </section>
      )}
    </div>
  );
}
