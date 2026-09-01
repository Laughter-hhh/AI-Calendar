"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ParseResult } from "../../../backend/ai/types";
import { cacheSet, setOfflineUserId } from "@/lib/offline";

interface Note {
  id: number;
  text: string;
  done: boolean;
  createdAt: string;
}

type ParseContext = { title?: string; date?: string; time?: string; endTime?: string };

interface ConvertState {
  note: Note;
  step: "parsing" | "asking" | "preview";
  result: ParseResult | null;
  context: ParseContext | null;
  reply: string;
  title: string;
  date: string;
  time: string;
  endTime: string;
  noteText: string;
  error: string;
  saving: boolean;
}

function repeatLabel(r?: string | null): string {
  if (r === "daily") return "每天";
  if (r === "weekly") return "每周";
  if (r === "monthly") return "每月";
  return "";
}

export default function NotesPanel({ initialNotes, userId }: { initialNotes: Note[]; userId: number }) {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [error, setError] = useState("");
  const [convert, setConvert] = useState<ConvertState | null>(null);
  const [returning, setReturning] = useState(false);

  // 记录最近一次笔记列表，供离线应用壳展示；账号指针与日程缓存保持一致。
  useEffect(() => {
    setOfflineUserId(userId);
    cacheSet("/api/notes", { notes });
  }, [notes, userId]);

  async function addNote() {
    const text = input.trim();
    if (!text || adding) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "添加失败，请重试");
        return;
      }
      setNotes((prev) => [data.note, ...prev]);
      setInput("");
    } catch {
      setError("网络错误，请重试");
    } finally {
      setAdding(false);
    }
  }

  async function toggleDone(note: Note) {
    const res = await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !note.done }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setNotes((prev) => prev.map((n) => (n.id === note.id ? data.note : n)));
  }

  function startEdit(note: Note) {
    setEditingId(note.id);
    setEditText(note.text);
  }

  async function saveEdit(note: Note) {
    const text = editText.trim();
    if (!text) return;
    const res = await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setNotes((prev) => prev.map((n) => (n.id === note.id ? data.note : n)));
    setEditingId(null);
  }

  async function removeNote(note: Note) {
    const res = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
    if (!res.ok) return;
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    if (convert?.note.id === note.id) setConvert(null);
  }

  async function clearDone() {
    const doneList = notes.filter((n) => n.done);
    for (const n of doneList) {
      await fetch(`/api/notes/${n.id}`, { method: "DELETE" });
    }
    setNotes((prev) => prev.filter((n) => !n.done));
  }

  function startConvert(note: Note) {
    setError("");
    setConvert({
      note,
      step: "parsing",
      result: null,
      context: null,
      reply: "",
      title: note.text,
      date: "",
      time: "",
      endTime: "",
      noteText: "",
      error: "",
      saving: false,
    });
    void parseForConvert(note.text, undefined, note);
  }

  async function parseForConvert(text: string, context?: ParseContext, note?: Note) {
    const targetNote = note ?? convert?.note;
    if (!targetNote) return;
    setConvert({
      note: targetNote,
      step: "parsing",
      result: null,
      context: null,
      reply: "",
      title: targetNote.text,
      date: "",
      time: "",
      endTime: "",
      noteText: "",
      error: "",
      saving: false,
    });
    try {
      const res = await fetch("/api/ai/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, context: context ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConvert((c) => (c ? { ...c, step: "asking", error: data.error ?? "理解失败，请重试" } : c));
        return;
      }
      const result: ParseResult = data.result;
      if (result.missing.length > 0) {
        const ev = result.events[0];
        setConvert((c) =>
          c
            ? {
                ...c,
                step: "asking",
                result,
                context: {
                  title: ev?.title,
                  date: ev?.date,
                  time: ev?.time ?? undefined,
                  endTime: ev?.endTime ?? undefined,
                },
              }
            : c
        );
        return;
      }
      const ev = result.events[0];
      setConvert((c) =>
        c
          ? {
              ...c,
              step: "preview",
              result,
              title: ev?.title ?? c.note.text,
              date: ev?.date ?? "",
              time: ev?.time ?? "",
              endTime: ev?.endTime ?? "",
              noteText: ev?.note ?? "",
            }
          : c
      );
    } catch {
      setConvert((c) => (c ? { ...c, step: "asking", error: "网络错误，请重试" } : c));
    }
  }

  async function confirmConvert() {
    if (!convert || !convert.result || convert.saving) return;
    if (convert.result.events.length === 1 && !convert.date) {
      setConvert({ ...convert, error: "请先选择日期" });
      return;
    }
    setConvert({ ...convert, saving: true, error: "" });
    try {
      const events = convert.result.events.map((ev) => {
        if (convert.result!.events.length === 1) {
          return {
            title: convert.title.trim(),
            date: convert.date,
            time: convert.time || null,
            endTime: convert.endTime || null,
            note: convert.noteText.trim() || null,
            repeat: ev.repeat ?? null,
            repeatUntil: ev.repeatUntil ?? null,
          };
        }
        return {
          title: ev.title,
          date: ev.date,
          time: ev.time ?? null,
          endTime: ev.endTime ?? null,
          note: ev.note ?? null,
          repeat: ev.repeat ?? null,
          repeatUntil: ev.repeatUntil ?? null,
        };
      });
      for (const ev of events) {
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...ev, sourceText: convert.note.text }),
        });
        if (!res.ok) throw new Error("save failed");
      }
      await fetch(`/api/notes/${convert.note.id}`, { method: "DELETE" });
      setNotes((prev) => prev.filter((n) => n.id !== convert.note.id));
      setConvert(null);
      router.refresh();
    } catch {
      setConvert((c) => (c ? { ...c, saving: false, error: "保存失败，笔记本条目未删除，请重试" } : c));
    }
  }

  const rowBtn = "ui-button-ghost h-9 px-2 text-xs";
  const doneCount = notes.filter((n) => n.done).length;

  function returnToCalendar() {
    if (returning) return;
    setReturning(true);
    // 从日历进入笔记本时优先回退历史记录，避免重新请求首页和整页加载。
    let cameFromCalendar = false;
    try {
      cameFromCalendar = Boolean(sessionStorage.getItem("aical:notes-return"));
      sessionStorage.removeItem("aical:notes-return");
    } catch {
      // 存储不可用时走首页导航。
    }
    if (cameFromCalendar) router.back();
    else router.push("/");
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">📒 笔记本</h1>
        <button
          type="button"
          onClick={returnToCalendar}
          disabled={returning}
          className="ui-button-ghost h-10 px-3 text-sm"
        >
          {returning ? "返回中…" : "← 返回日历"}
        </button>
      </div>
      <p className="mt-1.5 text-sm text-zinc-500">
        记录不确定什么时候做、但需要做的事；定好时间后可以一键转为日程。
      </p>

      {/* 添加输入 */}
      <div className="ui-card mt-5 flex items-center gap-2 p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addNote()}
          placeholder="写下一件不确定什么时候做的事…"
          maxLength={500}
          className="min-h-10 min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
        />
        <button
          onClick={addNote}
          disabled={adding || !input.trim()}
          className="ui-button-primary h-10 shrink-0 px-4 text-sm"
        >
          {adding ? "添加中…" : "添加"}
        </button>
      </div>

      {error && <p className="mt-2 text-center text-sm text-red-500">{error}</p>}

      {/* 列表 */}
      <div className="mt-4 flex flex-col gap-2">
        {notes.length === 0 && (
          <p className="ui-card border-dashed bg-white/75 px-4 py-10 text-center text-sm text-zinc-400">
            还没有内容，把「不确定什么时候做」的事先记在这里
          </p>
        )}
        {notes.map((note) => (
          <div
            key={note.id}
            className={`ui-card flex items-center gap-2.5 px-4 py-3 transition-shadow hover:shadow-md ${
              note.done ? "opacity-60" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={note.done}
              onChange={() => void toggleDone(note)}
              title={note.done ? "标记为未完成" : "标记为完成"}
              className="h-4 w-4 shrink-0 accent-zinc-900"
            />
            {editingId === note.id ? (
              <input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveEdit(note);
                  if (e.key === "Escape") setEditingId(null);
                }}
                autoFocus
                className="ui-input min-w-0 flex-1 px-3 text-sm"
              />
            ) : (
              <span
                className={`min-w-0 flex-1 break-words text-sm ${
                  note.done ? "text-zinc-400 line-through" : "text-zinc-800"
                }`}
              >
                {note.text}
              </span>
            )}
            <div className="flex shrink-0 items-center gap-0.5 text-zinc-500">
              {editingId === note.id ? (
                <>
                  <button className={`${rowBtn} text-zinc-900`} onClick={() => void saveEdit(note)}>
                    保存
                  </button>
                  <button className={rowBtn} onClick={() => setEditingId(null)}>
                    取消
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={`${rowBtn} text-zinc-700`}
                    title="转为日程"
                    onClick={() => startConvert(note)}
                  >
                    ⏰ 转为日程
                  </button>
                  <button className={rowBtn} title="编辑" onClick={() => startEdit(note)}>
                    ✏️
                  </button>
                  <button
                    className={`${rowBtn} text-red-500`}
                    title="删除"
                    onClick={() => void removeNote(note)}
                  >
                    🗑️
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {doneCount > 0 && (
        <button
          onClick={() => void clearDone()}
          className="ui-button-secondary mt-5 h-10 w-full text-sm"
        >
          清除已完成（{doneCount}）
        </button>
      )}

      {/* 转为日程面板 */}
      {convert && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setConvert(null)} />
          <div className="ui-card relative w-full max-w-lg rounded-t-3xl p-5 shadow-2xl md:rounded-3xl md:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-800">⏰ 转为日程</h2>
              <button
                onClick={() => setConvert(null)}
                className="ui-button-ghost h-9 w-9 px-0 text-sm"
              >
                ✕
              </button>
            </div>

            {convert.step === "parsing" && (
              <p className="mt-4 py-6 text-center text-sm text-zinc-500">正在理解这句话…</p>
            )}

            {convert.step === "asking" && (
              <div className="mt-3">
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {convert.error || convert.result?.message || "还需要补充一点信息"}
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    value={convert.reply}
                    onChange={(e) => setConvert({ ...convert, reply: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && convert.reply.trim() && void parseForConvert(convert.reply, convert.context ?? undefined)}
                    placeholder="补充信息，例如：下周三下午三点"
                    autoFocus
                    className="ui-input h-10 min-w-0 flex-1 px-3 text-sm"
                  />
                  <button
                    onClick={() => convert.reply.trim() && void parseForConvert(convert.reply, convert.context ?? undefined)}
                    className="ui-button-primary h-10 shrink-0 px-4 text-sm"
                  >
                    继续
                  </button>
                </div>
              </div>
            )}

            {convert.step === "preview" && convert.result && (
              <div className="mt-3">
                {convert.result.events.length === 1 ? (
                  <div className="flex flex-col gap-2 rounded-xl bg-sky-50/70 p-4">
                    <input
                      value={convert.title}
                      onChange={(e) => setConvert({ ...convert, title: e.target.value })}
                      placeholder="标题"
                    className="ui-input w-full px-3 text-sm"
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="date"
                        value={convert.date}
                        onChange={(e) => setConvert({ ...convert, date: e.target.value })}
                        className="ui-input flex-1 px-3 text-sm"
                      />
                      <input
                        type="time"
                        value={convert.time}
                        onChange={(e) => setConvert({ ...convert, time: e.target.value })}
                        className="ui-input flex-1 px-3 text-sm"
                      />
                    </div>
                    {convert.result.events[0]?.repeat && (
                      <p className="text-xs text-zinc-500">
                        重复：{repeatLabel(convert.result.events[0].repeat)}
                        {convert.result.events[0].repeatUntil
                          ? ` · 至 ${convert.result.events[0].repeatUntil}`
                          : ""}
                      </p>
                    )}
                  </div>
                ) : (
                  <ul className="flex flex-col gap-2 rounded-xl bg-sky-50/70 p-4">
                    {convert.result.events.map((ev, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm">
                        <span className="w-14 shrink-0 font-medium">{ev.time ?? "全天"}</span>
                        <span className="flex-1">{ev.title}</span>
                        <span className="text-xs text-zinc-400">{ev.date}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {convert.error && <p className="mt-2 text-center text-sm text-red-500">{convert.error}</p>}
                <p className="mt-2 text-xs text-zinc-400">确认后自动加入日历，并从笔记本移出。</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => void confirmConvert()}
                    disabled={convert.saving}
                    className="ui-button-primary h-10 flex-1 px-4 text-sm"
                  >
                    {convert.saving ? "保存中…" : "确认转为日程"}
                  </button>
                  <button
                    onClick={() => setConvert(null)}
                    className="ui-button-secondary h-10 px-4 text-sm"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
