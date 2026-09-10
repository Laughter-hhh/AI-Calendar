"use client";

import { useState } from "react";
import type { CalendarInfo } from "@/lib/calendars";

export default function CalendarSwitcher({
  calendars,
  activeId,
  onChange,
  onCreate,
  onRename,
  onDelete,
}: {
  calendars: CalendarInfo[];
  activeId: number;
  onChange: (id: number) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = calendars.find((item) => item.id === activeId) ?? calendars[0];

  async function create() {
    if (!name.trim()) { setError("请输入日历名称"); return; }
    setBusy(true); setError("");
    try { await onCreate(name.trim()); setName(""); }
    catch (err) { setError(err instanceof Error ? err.message : "创建失败"); }
    finally { setBusy(false); }
  }

  async function rename(calendar: CalendarInfo) {
    const next = window.prompt("修改日历名称", calendar.name);
    if (next === null || !next.trim() || next.trim() === calendar.name) return;
    setBusy(true); setError("");
    try { await onRename(calendar.id, next.trim()); }
    catch (err) { setError(err instanceof Error ? err.message : "修改失败"); }
    finally { setBusy(false); }
  }

  async function remove(calendar: CalendarInfo) {
    if (!window.confirm(`删除“${calendar.name}”及其中的日程吗？`)) return;
    setBusy(true); setError("");
    try { await onDelete(calendar.id); }
    catch (err) { setError(err instanceof Error ? err.message : "删除失败"); }
    finally { setBusy(false); }
  }

  if (!active) return null;
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-sky-100 bg-white/75 px-2 py-1.5 shadow-sm">
      <span className="text-[11px] font-semibold text-sky-700/75">当前日历</span>
      <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400" aria-hidden="true" />
      <select value={active.id} onChange={(event) => onChange(Number(event.target.value))} className="ui-input h-8 min-w-0 flex-1 px-2 text-xs sm:max-w-xs" aria-label="切换日历">
        {calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}
      </select>
      <button type="button" onClick={() => { setManageOpen((open) => !open); setError(""); }} className="ui-button-secondary h-8 px-2.5 text-[11px]">管理</button>
      {manageOpen && (
        <div className="basis-full border-t border-sky-100 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} placeholder="新日历名称，例如：家人" className="ui-input h-8 min-w-0 flex-1 px-2.5 text-xs" />
            <button type="button" disabled={busy} onClick={() => void create()} className="ui-button-primary h-8 px-2.5 text-[11px]">＋ 新建</button>
            <button type="button" disabled={busy} onClick={() => void rename(active)} className="ui-button-secondary h-8 px-2.5 text-[11px]">重命名</button>
            <button type="button" disabled={busy || calendars.length <= 1} onClick={() => void remove(active)} className="h-8 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[11px] font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-45">删除</button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">每个日历的日程、节日标记独立保存；删除日历会同时删除其中内容。</p>
          {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
