"use client";

import { useState } from "react";
import type { CalendarEvent } from "@/lib/events";
import { EVENT_COLORS, colorDot, colorText } from "@/lib/colors";
import { eventTimingError } from "@/lib/event-validation";

function repeatLabel(repeat: string): string {
  if (repeat === "daily") return "每天";
  if (repeat === "weekly") return "每周";
  if (repeat === "monthly") return "每月";
  return repeat;
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
  events,
  isToday,
  query,
  onRefresh,
}: {
  events: CalendarEvent[];
  isToday: boolean;
  query: string;
  onRefresh: () => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [draft, setDraft] = useState<Draft>({
    title: "",
    date: "",
    time: "",
    endTime: "",
    note: "",
    color: "",
  });

  const visible = events.filter(
    (event) => !query || event.title.toLowerCase().includes(query.toLowerCase())
  );

  async function removeSeries(event: CalendarEvent) {
    const tip = event.repeat ? "这会把整个重复系列都删除，确定吗？" : "确定删除这个日程吗？";
    if (!window.confirm(tip)) return;
    await fetch(`/api/events/${event.id}`, { method: "DELETE" });
    setActionId(null);
    await onRefresh();
  }

  async function removeSingle(event: CalendarEvent) {
    if (!window.confirm(`只删除 ${event.date} 这一天的日程？系列其他日期保留。`)) return;
    await fetch(`/api/events/${event.id}?mode=single&date=${event.date}`, { method: "DELETE" });
    setActionId(null);
    await onRefresh();
  }

  async function toggleDone(event: CalendarEvent) {
    await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !event.done }),
    });
    await onRefresh();
  }

  function startEdit(event: CalendarEvent) {
    setEditingId(event.id);
    setDetailId(null);
    setActionId(null);
    setEditError("");
    setDraft({
      title: event.title,
      date: event.date,
      time: event.startTime ?? "",
      endTime: event.endTime ?? "",
      note: event.note ?? "",
      color: event.color ?? "",
    });
  }

  async function saveEdit(id: number) {
    if (!draft.title.trim()) {
      setEditError("标题不能为空");
      return;
    }
    if (!draft.date) {
      setEditError("请选择日期");
      return;
    }
    const timingError = eventTimingError(draft.time || null, draft.endTime || null);
    if (timingError) {
      setEditError(timingError);
      return;
    }

    setSaving(true);
    setEditError("");
    try {
      const response = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title.trim(),
          date: draft.date,
          time: draft.time || null,
          endTime: draft.endTime || null,
          note: draft.note.trim() || null,
          color: draft.color || null,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setEditError(result.error ?? "保存失败，请重试");
        return;
      }
      setEditingId(null);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-8 text-center">
        <p className="text-sm text-zinc-500">
          {query ? "没有匹配的日程" : isToday ? "今天还没有日程" : "这一天还没有日程"}
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          试试告诉 AI：&ldquo;明天下午三点开会&rdquo;
        </p>
      </div>
    );
  }

  const timed = visible.filter((event) => event.startTime !== null);
  const todos = visible.filter((event) => event.startTime === null);

  const renderItem = (event: CalendarEvent) => (
    <li key={event.id} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm md:px-4 md:py-2.5">
      {editingId === event.id ? (
        <div className="space-y-2.5">
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-500">标题</span>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            <label>
              <span className="mb-1 block text-xs text-zinc-500">日期</span>
              <input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs text-zinc-500">开始时间（留空为全天）</span>
              <input
                type="time"
                step={300}
                value={draft.time}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    time: e.target.value,
                    endTime: e.target.value ? draft.endTime : "",
                  })
                }
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs text-zinc-500">结束时间</span>
              <input
                type="time"
                step={300}
                value={draft.endTime}
                disabled={!draft.time}
                min={draft.time || undefined}
                onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 disabled:bg-zinc-100 disabled:text-zinc-400"
              />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
            <label>
              <span className="mb-1 block text-xs text-zinc-500">备注</span>
              <input
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                placeholder="可选"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs text-zinc-500">颜色</span>
              <select
                value={draft.color}
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              >
                {EVENT_COLORS.map((color) => (
                  <option key={color.value} value={color.value}>
                    {color.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {editError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {editError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => saveEdit(event.id)}
              disabled={saving}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存"}
            </button>
            <button
              onClick={() => setEditingId(null)}
              disabled={saving}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex min-w-0 items-center gap-2">
            {!event.ownerEmail && (
              <input
                type="checkbox"
                checked={event.done}
                onChange={() => toggleDone(event)}
                title={event.done ? "标记为未完成" : "标记为完成"}
                className="h-4 w-4 shrink-0 accent-zinc-900"
              />
            )}
            <button
              onClick={() => setDetailId(detailId === event.id ? null : event.id)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <span
                className={`w-[5.75rem] shrink-0 whitespace-nowrap text-[11px] font-semibold tabular-nums md:w-28 md:text-sm ${
                  event.done ? "text-zinc-300 line-through" : colorText(event.color)
                }`}
              >
                {event.startTime
                  ? `${event.startTime}${event.endTime ? `–${event.endTime}` : ""}`
                  : "全天"}
              </span>
              <span className={`h-2 w-2 shrink-0 rounded-full ${colorDot(event.color)}`} />
              <span className="flex min-w-0 flex-1 items-baseline gap-1.5 overflow-hidden">
                <span
                  className={`truncate text-sm font-medium md:text-base ${
                    event.done ? "text-zinc-400 line-through" : ""
                  }`}
                >
                  {event.title}
                </span>
                {event.note && (
                  <span className="hidden min-w-0 truncate text-xs text-zinc-400 sm:inline">
                    · {event.note}
                  </span>
                )}
              </span>
              {event.repeat && (
                <span className="hidden shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 sm:inline">
                  {repeatLabel(event.repeat)}
                </span>
              )}
              {event.ownerEmail && (
                <span
                  className="hidden max-w-28 shrink-0 truncate rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-500 sm:inline"
                  title={event.ownerEmail}
                >
                  来自 {event.ownerEmail}
                </span>
              )}
            </button>
            {!event.ownerEmail && (
              <button
                onClick={() => setActionId(actionId === event.id ? null : event.id)}
                className="shrink-0 rounded-md px-2 py-1 text-base leading-none text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                aria-label={`${event.title} 的操作`}
                aria-expanded={actionId === event.id}
              >
                ⋯
              </button>
            )}
          </div>

          {event.note && <p className="mt-1 truncate pl-[7.75rem] text-xs text-zinc-400 sm:hidden">{event.note}</p>}

          {actionId === event.id && !event.ownerEmail && (
            <div className="mt-2 flex flex-wrap justify-end gap-1 border-t border-zinc-100 pt-2">
              <button
                onClick={() => startEdit(event)}
                className="whitespace-nowrap rounded-md bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-200"
              >
                编辑
              </button>
              {event.repeat && (
                <button
                  onClick={() => removeSingle(event)}
                  className="whitespace-nowrap rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-500 hover:bg-red-100"
                >
                  仅删此日
                </button>
              )}
              <button
                onClick={() => removeSeries(event)}
                className="whitespace-nowrap rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-500 hover:bg-red-100"
              >
                {event.repeat ? "删除整个系列" : "删除"}
              </button>
            </div>
          )}

          {detailId === event.id && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
              <span>状态：{event.done ? "已完成 ✅" : "未完成"}</span>
              <span>
                日期：{event.date} {event.startTime ?? "全天"}
                {event.endTime ? `–${event.endTime}` : ""}
              </span>
              {event.repeat && (
                <span>
                  重复：{repeatLabel(event.repeat)}
                  {event.repeatUntil ? `，至 ${event.repeatUntil}` : ""}
                </span>
              )}
              {event.ownerEmail && <span>来源：{event.ownerEmail} 共享（只读）</span>}
              {event.sourceText && <span className="min-w-0 truncate text-zinc-400">原始说法：{event.sourceText}</span>}
            </div>
          )}
        </div>
      )}
    </li>
  );

  return (
    <div className="flex flex-col gap-3">
      {timed.length > 0 && (
        <section>
          {todos.length > 0 && <h3 className="mb-1.5 text-xs font-semibold text-zinc-400">⏰ 定时日程</h3>}
          <ul className="flex flex-col gap-1.5">{timed.map(renderItem)}</ul>
        </section>
      )}
      {todos.length > 0 && (
        <section>
          {timed.length > 0 && <h3 className="mb-1.5 text-xs font-semibold text-zinc-400">☑ 待办事项</h3>}
          <ul className="flex flex-col gap-1.5">{todos.map(renderItem)}</ul>
        </section>
      )}
    </div>
  );
}
