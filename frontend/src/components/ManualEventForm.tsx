"use client";

import { useState } from "react";
import { EVENT_COLORS } from "@/lib/colors";
import { eventTimingError } from "@/lib/event-validation";
import { enqueueMutation } from "@/lib/offline";

function repeatLabel(value: string): string {
  if (value === "weekly") return "每周";
  if (value === "biweekly") return "每两周";
  if (value === "monthly") return "每月";
  return "单日（仅一次）";
}

export default function ManualEventForm({
  initialDate,
  calendarId,
  onClose,
  onSaved,
}: {
  initialDate: string;
  calendarId: number;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [repeat, setRepeat] = useState("none");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [color, setColor] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("请填写标题");
      return;
    }
    if (!date) {
      setError("请选择日期");
      return;
    }
    const timingError = eventTimingError(time || null, endTime || null);
    if (timingError) {
      setError(timingError);
      return;
    }
    if (repeat !== "none" && repeatUntil && repeatUntil < date) {
      setError("重复截止日期不能早于开始日期");
      return;
    }
    const payload = {
      calendarId,
      title: cleanTitle,
      date,
      time: time || null,
      endTime: time ? endTime || null : null,
      repeat: repeat === "none" ? null : repeat,
      repeatUntil: repeat === "none" ? null : repeatUntil || null,
      color: color || null,
      note: note.trim() || null,
    };
    setSaving(true);
    setError("");
    try {
      let response: Response;
      try {
        response = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        enqueueMutation({ url: "/api/events", method: "POST", body: payload });
        await onSaved("已离线暂存，联网后会自动加入日历。");
        onClose();
        return;
      }
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        conflicts?: Array<{ title?: string }>;
      };
      if (!response.ok) {
        setError(result.error ?? "保存失败，请重试");
        return;
      }
      const conflictTitles = Array.isArray(result.conflicts)
        ? result.conflicts.map((item) => item.title).filter((item): item is string => Boolean(item))
        : [];
      await onSaved(
        conflictTitles.length > 0
          ? `已添加，但与以下日程时间重叠：${conflictTitles.join("、")}`
          : "已添加到日历。"
      );
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-slate-900/35 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="手动添加日程">
      <form onSubmit={submit} className="ui-card w-full max-w-xl space-y-3 p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-base font-semibold text-slate-800">手动添加日程</h2><p className="mt-1 text-xs text-slate-500">不使用 AI，也可以直接填写日程信息</p></div>
          <button type="button" onClick={onClose} className="ui-button-ghost h-9 w-9 px-0" aria-label="关闭">✕</button>
        </div>
        <label className="block text-xs font-medium text-slate-600">标题<input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} autoFocus placeholder="例如：项目复盘" className="ui-input mt-1 w-full px-3 text-sm" /></label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs font-medium text-slate-600">日期<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="ui-input mt-1 w-full px-3 text-sm" /></label>
          <label className="block text-xs font-medium text-slate-600">开始时间（可选）<input type="time" step={300} value={time} onChange={(event) => { setTime(event.target.value); if (!event.target.value) setEndTime(""); }} className="ui-input mt-1 w-full px-3 text-sm" /></label>
          <label className="block text-xs font-medium text-slate-600">结束时间<input type="time" step={300} min={time || undefined} disabled={!time} value={endTime} onChange={(event) => setEndTime(event.target.value)} className="ui-input mt-1 w-full px-3 text-sm disabled:bg-slate-100 disabled:text-slate-400" /></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs font-medium text-slate-600">重复方式<select value={repeat} onChange={(event) => { setRepeat(event.target.value); if (event.target.value === "none") setRepeatUntil(""); }} className="ui-input mt-1 w-full px-3 text-sm">{["none", "weekly", "biweekly", "monthly"].map((value) => <option key={value} value={value}>{repeatLabel(value)}</option>)}</select></label>
          <label className="block text-xs font-medium text-slate-600">重复截止（可选）<input type="date" min={date} disabled={repeat === "none"} value={repeatUntil} onChange={(event) => setRepeatUntil(event.target.value)} className="ui-input mt-1 w-full px-3 text-sm disabled:bg-slate-100 disabled:text-slate-400" /></label>
          <label className="block text-xs font-medium text-slate-600">颜色<select value={color} onChange={(event) => setColor(event.target.value)} className="ui-input mt-1 w-full px-3 text-sm">{EVENT_COLORS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        </div>
        <label className="block text-xs font-medium text-slate-600">备注（可选）<textarea maxLength={500} rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="补充地点、参与人或提醒" className="ui-input mt-1 w-full resize-none px-3 py-2 text-sm" /></label>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={onClose} disabled={saving} className="ui-button-secondary h-10 px-4">取消</button><button type="submit" disabled={saving} className="ui-button-primary h-10 px-5">{saving ? "保存中…" : "添加日程"}</button></div>
      </form>
    </div>
  );
}
