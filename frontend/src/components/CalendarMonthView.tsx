"use client";

import { useMemo, useState } from "react";
import type { CalendarEvent } from "@/lib/events";
import {
  builtinCalendarMarks,
  type CalendarMark,
  type CalendarMarkType,
  type NewCalendarMark,
} from "@/lib/calendar-mark-types";
import { shiftDate, shiftMonth, todayStr } from "@/lib/date";

function monthStartOf(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

function daysInMonth(dateStr: string): number {
  const [year, month] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function weekdayOfMonthStart(dateStr: string): number {
  return new Date(`${monthStartOf(dateStr)}T00:00:00Z`).getUTCDay();
}

function monthLabel(dateStr: string): string {
  const [year, month] = dateStr.split("-").map(Number);
  return `${year}年${month}月`;
}

function markTypeClass(type: CalendarMarkType): string {
  if (type === "holiday") return "border-rose-200 bg-rose-50 text-rose-700";
  if (type === "anniversary") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

export default function CalendarMonthView({
  initialEvents,
  initialMarks,
  startDate,
  query,
  onMonthChange,
  onSelectDay,
  onCreateMark,
  onUpdateMark,
  onDeleteMark,
}: {
  initialEvents: CalendarEvent[];
  initialMarks: CalendarMark[];
  startDate: string;
  query: string;
  onMonthChange: (monthDate: string) => void;
  onSelectDay: (day: string) => void;
  onCreateMark: (mark: NewCalendarMark) => Promise<void>;
  onUpdateMark: (id: number, mark: NewCalendarMark) => Promise<void>;
  onDeleteMark: (id: number) => Promise<void>;
}) {
  const month = monthStartOf(startDate);
  const today = todayStr();
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<NewCalendarMark>({ date: month, title: "", type: "anniversary", note: "" });

  const groupedEvents = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of initialEvents) {
      if (query && !event.title.toLowerCase().includes(query.toLowerCase())) continue;
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [initialEvents, query]);

  const groupedMarks = useMemo(() => {
    const map = new Map<string, Array<CalendarMark | { id: string; date: string; title: string; type: Exclude<CalendarMarkType, "custom">; builtin: true }>>();
    for (const mark of builtinCalendarMarks(month, shiftDate(shiftMonth(month, 1), -1))) {
      const list = map.get(mark.date) ?? [];
      list.push({ ...mark, builtin: true });
      map.set(mark.date, list);
    }
    for (const mark of initialMarks) {
      const list = map.get(mark.date) ?? [];
      list.push(mark);
      map.set(mark.date, list);
    }
    return map;
  }, [initialMarks, month]);

  const total = daysInMonth(month);
  const lead = weekdayOfMonthStart(month);
  const cells: Array<string | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, index) => `${month.slice(0, 7)}-${String(index + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

  function openNew(date = `${month.slice(0, 7)}-01`) {
    setEditingId(null);
    setForm({ date, title: "", type: "anniversary", note: "" });
    setError("");
    setFormOpen(true);
  }

  function openEdit(mark: CalendarMark) {
    setEditingId(mark.id);
    setForm({ date: mark.date, title: mark.title, type: mark.type, note: mark.note ?? "" });
    setError("");
    setFormOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title?.trim()) {
      setError("请填写名称");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editingId === null) await onCreateMark({ ...form, title: form.title.trim() });
      else await onUpdateMark(editingId, { ...form, title: form.title.trim() });
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  async function remove(mark: CalendarMark) {
    if (!window.confirm(`删除“${mark.title}”吗？`)) return;
    setSaving(true);
    setError("");
    try {
      await onDeleteMark(mark.id);
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ui-card p-3 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-800">{monthLabel(month)}</h3>
          <p className="mt-1 text-xs text-slate-500">节日与纪念日 · 我的标记可编辑</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button type="button" onClick={() => onMonthChange(shiftMonth(month, -1))} className="ui-button-secondary h-9 px-3">上月</button>
          <button type="button" onClick={() => onMonthChange(monthStartOf(today))} className="ui-button-primary h-9 px-3">今天</button>
          <button type="button" onClick={() => onMonthChange(shiftMonth(month, 1))} className="ui-button-secondary h-9 px-3">下月</button>
          <button type="button" onClick={() => openNew()} className="ui-button-primary h-9 px-3">＋ 添加标记</button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
        <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">节日</span>
        <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-violet-700">纪念日</span>
        <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-sky-700">我的标记</span>
        <span className="ml-auto">点击日期查看当天日程</span>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl bg-sky-100 text-center">
        {weekdays.map((weekday, index) => (
          <div key={weekday} className={`bg-sky-50 py-2 text-xs font-medium ${index === 0 || index === 6 ? "text-rose-500" : "text-sky-700/80"}`}>{weekday}</div>
        ))}
        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} className="min-h-[7.5rem] bg-white/80 md:min-h-[9.2rem]" />;
          const dayMarks = groupedMarks.get(day) ?? [];
          const dayEvents = groupedEvents.get(day) ?? [];
          const weekend = index % 7 === 0 || index % 7 === 6;
          const isToday = day === today;
          return (
            <div
              key={day}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDay(day)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelectDay(day); }}
              className={`group flex min-h-[7.5rem] cursor-pointer flex-col items-stretch gap-1 bg-white p-2 text-left transition hover:bg-sky-50 md:min-h-[9.2rem] ${weekend ? "bg-slate-50/70" : ""} ${isToday ? "ring-2 ring-inset ring-amber-300" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm ${isToday ? "font-bold text-amber-700" : weekend ? "text-rose-500" : "text-slate-700"}`}>{Number(day.slice(8, 10))}</span>
                <button type="button" onClick={(event) => { event.stopPropagation(); openNew(day); }} className="rounded-full px-1.5 text-sm text-sky-400 opacity-0 transition hover:bg-sky-100 hover:text-sky-700 group-hover:opacity-100" aria-label={`在${day}添加标记`}>＋</button>
              </div>
              <div className="min-h-0 space-y-1">
                {dayMarks.slice(0, 3).map((mark) => {
                  const isBuiltin = "builtin" in mark && mark.builtin;
                  return (
                    <div key={isBuiltin ? mark.id : `mark-${mark.id}`} className={`flex min-w-0 items-center gap-1 rounded-lg border px-1.5 py-1 text-[11px] leading-4 ${markTypeClass(mark.type)}`} onClick={(event) => { event.stopPropagation(); if (!isBuiltin) openEdit(mark as CalendarMark); }}>
                      <span className="min-w-0 flex-1 truncate">{mark.title}</span>
                      {!isBuiltin && <span className="shrink-0 text-[10px] opacity-60">编辑</span>}
                    </div>
                  );
                })}
                {dayMarks.length > 3 && <span className="block px-1 text-[10px] text-slate-400">+{dayMarks.length - 3} 个标记</span>}
              </div>
              {dayEvents.length > 0 && <div className="mt-auto truncate rounded-md bg-emerald-50 px-1.5 py-1 text-[11px] text-emerald-700">日程 {dayEvents.length} 项</div>}
            </div>
          );
        })}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/35 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={editingId === null ? "添加日历标记" : "编辑日历标记"}>
          <form onSubmit={submit} className="ui-card w-full max-w-md space-y-3 p-5 shadow-2xl">
            <div className="flex items-center justify-between"><h4 className="text-base font-semibold text-slate-800">{editingId === null ? "添加日历标记" : "编辑日历标记"}</h4><button type="button" onClick={() => setFormOpen(false)} className="ui-button-ghost h-8 px-2">✕</button></div>
            <label className="block text-xs font-medium text-slate-600">日期<input required type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} className="ui-input mt-1 w-full px-3 text-sm" /></label>
            <label className="block text-xs font-medium text-slate-600">名称<input required maxLength={80} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="例如：妈妈生日" className="ui-input mt-1 w-full px-3 text-sm" /></label>
            <label className="block text-xs font-medium text-slate-600">类型<select value={form.type ?? "anniversary"} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as CalendarMarkType }))} className="ui-input mt-1 w-full px-3 text-sm"><option value="holiday">节日</option><option value="anniversary">纪念日</option><option value="custom">自定义</option></select></label>
            <label className="block text-xs font-medium text-slate-600">备注（可选）<textarea maxLength={300} value={form.note ?? ""} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} rows={2} className="ui-input mt-1 w-full resize-none px-3 py-2 text-sm" /></label>
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
            <div className="flex items-center justify-between gap-2 pt-1">
              {editingId !== null ? <button type="button" disabled={saving} onClick={() => { const mark = initialMarks.find((item) => item.id === editingId); if (mark) void remove(mark); }} className="ui-button-ghost h-10 px-2 text-rose-600">删除</button> : <span />}
              <div className="flex gap-2"><button type="button" onClick={() => setFormOpen(false)} className="ui-button-secondary h-10 px-4">取消</button><button type="submit" disabled={saving} className="ui-button-primary h-10 px-5">{saving ? "保存中…" : "保存"}</button></div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
