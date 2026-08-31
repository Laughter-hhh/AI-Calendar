"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ParseResult } from "../../../backend/ai/types";

interface Note {
  id: number;
  text: string;
  done: boolean;
  createdAt: string;
}

type ParseContext = { title?: string; date?: string; time?: string };

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

export default function NotesPanel({ initialNotes }: { initialNotes: Note[] }) {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [error, setError] = useState("");
  const [convert, setConvert] = useState<ConvertState | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/notes");
        if (!cancelled && res.ok) {
          const data = await res.json();
          setNotes(Array.isArray(data.notes) ? data.notes : []);
        }
      } catch {
        // 保留服务端传入的初始列表，网络恢复后用户仍可手动操作。
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const rowBtn = "rounded-lg px-2 py-1 text-xs hover:bg-zinc-100";
  const doneCount = notes.filter((n) => n.done).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">📒 笔记本</h1>
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-700">
          ← 返回日历
        </Link>
      </div>
      <p className="mt-1.5 text-sm text-zinc-500">
        记录不确定什么时候做、但需要做的事；定好时间后可以一键转为日程。
      </p>

      {/* 添加输入 */}
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addNote()}
          placeholder="写下一件不确定什么时候做的事…"
          maxLength={500}
          className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm outline-none"
        />
        <button
          onClick={addNote}
          disabled={adding || !input.trim()}
          className="shrink-0 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
        >
          {adding ? "添加中…" : "添加"}
        </button>
      </div>

      {error && <p className="mt-2 text-center text-sm text-red-500">{error}</p>}

      {/* 列表 */}
      <div className="mt-4 flex flex-col gap-2">
        {notes.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-white/60 px-4 py-8 text-center text-sm text-zinc-400">
            还没有内容，把「不确定什么时候做」的事先记在这里
          </p>
        )}
        {notes.map((note) => (
          <div
            key={note.id}
            className={`flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 shadow-sm ${
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
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-500"
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
          className="mt-4 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
        >
          清除已完成（{doneCount}）
        </button>
      )}

      {/* 转为日程面板 */}
      {convert && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setConvert(null)} />
          <div className="relative w-full max-w-lg rounded-t-2xl bg-white p-4 shadow-2xl md:rounded-2xl md:p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-800">⏰ 转为日程</h2>
              <button
                onClick={() => setConvert(null)}
                className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-100"
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
                    className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                  />
                  <button
                    onClick={() => convert.reply.trim() && void parseForConvert(convert.reply, convert.context ?? undefined)}
                    className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700"
                  >
                    继续
                  </button>
                </div>
              </div>
            )}

            {convert.step === "preview" && convert.result && (
              <div className="mt-3">
                {convert.result.events.length === 1 ? (
                  <div className="flex flex-col gap-2 rounded-xl bg-zinc-50 p-3">
                    <input
                      value={convert.title}
                      onChange={(e) => setConvert({ ...convert, title: e.target.value })}
                      placeholder="标题"
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="date"
                        value={convert.date}
                        onChange={(e) => setConvert({ ...convert, date: e.target.value })}
                        className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
                      />
                      <input
                        type="time"
                        value={convert.time}
                        onChange={(e) => setConvert({ ...convert, time: e.target.value })}
                        className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
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
                  <ul className="flex flex-col gap-1.5 rounded-xl bg-zinc-50 p-3">
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
                    className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                  >
                    {convert.saving ? "保存中…" : "确认转为日程"}
                  </button>
                  <button
                    onClick={() => setConvert(null)}
                    className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
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
