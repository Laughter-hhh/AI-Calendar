"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ParseResult } from "../../../backend/ai/types";
import type { ActionResult } from "../../../backend/ai/action";
import { enqueueMutation } from "@/lib/offline";

type Status = "idle" | "parsing" | "asking" | "preview" | "action";

function repeatLabel(r?: string | null): string {
  if (r === "daily") return "每天";
  if (r === "weekly") return "每周";
  if (r === "monthly") return "每月";
  return r ?? "";
}

export default function AiInput() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const [info, setInfo] = useState("");
  const [context, setContext] = useState<{ title?: string; date?: string; time?: string; endTime?: string } | null>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const mediaRecorderRef = useRef<{ stop: () => void } | null>(null);

  async function submit(input: string) {
    setStatus("parsing");
    setError("");
    setInfo("");
    try {
      // 先判断是否是要"修改/删除已有日程"（如：把学习改到晚上九点 / 删除明天的会议）
      const actionRes = await fetch("/api/ai/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      const actionData = await actionRes.json();
      const ar: ActionResult | undefined = actionData.result;
      if (actionRes.ok && ar?.action) {
        setActionResult(ar);
        setStatus("action");
        return;
      }
      if (actionRes.ok && ar?.message) {
        // 有修改/删除意图但没找到目标，或需要用户澄清
        setInfo(ar.message);
        setStatus("idle");
        return;
      }
    } catch {
      // action 接口异常时直接走创建流程
    }
    await parse(input);
  }

  async function parse(input: string) {
    setStatus("parsing");
    setError("");
    try {
      const res = await fetch("/api/ai/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, context }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "解析失败，请重试");
        setStatus("idle");
        return;
      }
      const r: ParseResult = data.result;
      setResult(r);
      if (r.missing.length > 0) {
        // 信息不全：追问用户（产品原则：不猜测）
        setContext({
          title: r.events[0]?.title || undefined,
          date: r.events[0]?.date || undefined,
          time: r.events[0]?.time || undefined,
          endTime: r.events[0]?.endTime || undefined,
        });
        setStatus("asking");
      } else {
        setContext(null);
        setStatus("preview");
      }
    } catch {
      setError("网络错误，请重试");
      setStatus("idle");
    }
  }

  function reset() {
    setText("");
    setReply("");
    setResult(null);
    setActionResult(null);
    setInfo("");
    setContext(null);
    setStatus("idle");
    setError("");
  }

  async function saveAll() {
    if (!result) return;
    setSaving(true);
    const conflictTitles: string[] = [];
    let queuedCount = 0;
    try {
      for (const ev of result.events) {
        const payload = { ...ev, sourceText: text };
        let response: Response;
        try {
          response = await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } catch {
          enqueueMutation({ url: "/api/events", method: "POST", body: payload });
          queuedCount += 1;
          continue;
        }
        const data = await response.json().catch(() => ({}));
        if (Array.isArray(data.conflicts)) {
          conflictTitles.push(...data.conflicts.map((item: { title?: string }) => item.title).filter(Boolean));
        }
        if (!response.ok) throw new Error(data.error ?? "保存失败");
      }
      reset();
      if (queuedCount > 0) {
        setInfo(`${queuedCount} 项已离线暂存，联网后会自动加入日历。`);
      } else if (conflictTitles.length > 0) {
        setInfo(`已添加，但与以下日程时间重叠：${conflictTitles.join("、")}`);
      }
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  async function confirmAction() {
    if (!actionResult?.event) return;
    setSaving(true);
    try {
      if (actionResult.action === "delete") {
        await fetch(`/api/events/${actionResult.event.id}`, { method: "DELETE" });
      } else if (actionResult.action === "done") {
        await fetch(`/api/events/${actionResult.event.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done: true }),
        });
      } else if (actionResult.action === "update" && actionResult.changes) {
        await fetch(`/api/events/${actionResult.event.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(actionResult.changes),
        });
      }
      reset();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function toggleVoice() {
    const SR =
      (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!SR) {
      // 手机等不支持浏览器语音的环境：录音上传识别
      if (listening) {
        mediaRecorderRef.current?.stop();
        return;
      }
      startRecording();
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new SR() as {
      lang: string;
      interimResults: boolean;
      start: () => void;
      stop: () => void;
      onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
    };
    rec.lang = "zh-CN";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join("");
      setText((prev) => (prev ? `${prev}${transcript}` : transcript));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setListening(false);
        const blob = new Blob(chunks, { type: "audio/webm" });
        await uploadAudio(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setListening(true);
    } catch {
      setError("无法使用麦克风，请检查权限或改用文字输入");
    }
  }

  async function uploadAudio(blob: Blob) {
    setStatus("parsing");
    setError("");
    try {
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      const res = await fetch("/api/ai/stt", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "语音识别失败");
        setStatus("idle");
        return;
      }
      setText((prev) => (prev ? `${prev}${data.text}` : data.text));
      setStatus("idle");
    } catch {
      setError("网络错误，语音识别失败");
      setStatus("idle");
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#f5faff] via-[#f5faff]/95 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-10">
      <div className="mx-auto w-full max-w-6xl">
        {status === "action" && actionResult?.event && (
          <div className="ui-card mb-3 p-4">
            <p className="text-sm">{actionResult.message}</p>
            <p className="mt-2 rounded-xl bg-sky-50 px-3 py-2.5 text-xs text-sky-900/70">
              {actionResult.event.title} · {actionResult.event.date}
              {actionResult.event.time ? ` ${actionResult.event.time}` : ""}
              {actionResult.event.repeat ? ` · 重复：${repeatLabel(actionResult.event.repeat)}` : ""}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={confirmAction}
                disabled={saving}
                className="ui-button-primary h-10 px-4 text-sm"
              >
                {saving
                  ? "处理中…"
                  : actionResult.action === "delete"
                    ? "确认删除"
                    : actionResult.action === "done"
                      ? "确认完成"
                      : "确认修改"}
              </button>
              <button onClick={reset} className="ui-button-ghost h-10 px-3 text-sm">
                取消
              </button>
            </div>
          </div>
        )}

        {info && (
          <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 p-3">
            <p className="text-sm text-sky-800">{info}</p>
          </div>
        )}

        {status === "asking" && result && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/90 p-3">
            <p className="text-sm text-amber-800">{result.message}</p>
            <div className="mt-2 flex gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && reply.trim() && parse(reply)}
                placeholder="补充信息，例如：晚上八点"
                className="ui-input h-10 flex-1 border-amber-200 px-3 text-sm focus:border-amber-400"
              />
              <button
                onClick={() => reply.trim() && parse(reply)}
                className="ui-button-primary h-10 bg-gradient-to-r from-amber-500 to-orange-500 px-4 text-sm"
              >
                继续
              </button>
              <button onClick={reset} className="ui-button-ghost h-10 px-3 text-sm">
                取消
              </button>
            </div>
          </div>
        )}

        {status === "preview" && result && (
          <div className="ui-card mb-3 p-4">
            <p className="text-xs text-zinc-400">AI 已理解，确认后保存</p>
            <ul className="mt-2 flex flex-col gap-2">
              {result.events.map((ev, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl bg-sky-50/80 px-3 py-2.5">
                  <span className="w-14 shrink-0 text-sm font-medium">{ev.time ?? "全天"}</span>
                  <span className="text-sm">{ev.title}</span>
                  <span className="ml-auto text-xs text-zinc-400">{ev.date}</span>
                </li>
              ))}
            </ul>
            {result.events[0]?.repeat && (
              <p className="mt-2 text-xs text-zinc-400">
                重复：{repeatLabel(result.events[0].repeat)}
                {result.events[0].repeatUntil ? ` · 至 ${result.events[0].repeatUntil}` : ""}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                onClick={saveAll}
                disabled={saving}
                className="ui-button-primary h-10 px-4 text-sm"
              >
                {saving ? "保存中…" : "确认添加"}
              </button>
              <button onClick={reset} className="ui-button-ghost h-10 px-3 text-sm">
                取消
              </button>
            </div>
          </div>
        )}

        {error && <p className="mb-2 text-center text-sm text-red-500">{error}</p>}

        <div className="ui-card flex items-end gap-2 p-2">
          <button
            onClick={toggleVoice}
            title="语音输入"
            className={`h-10 w-11 shrink-0 rounded-xl px-0 text-lg transition-colors ${
              listening ? "bg-rose-500 text-white shadow-sm" : "ui-button-secondary text-sky-700"
            }`}
          >
            {listening ? "◉" : "🎤"}
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && text.trim() && status !== "parsing" && submit(text)}
            placeholder={
              status === "parsing"
                ? "正在理解你的话…"
                : "告诉 AI 你要做什么，例如：明天下午三点开会；或：把学习改到晚上九点"
            }
            disabled={status === "parsing"}
            className="min-h-10 min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
          />
          <button
            onClick={() => text.trim() && submit(text)}
            disabled={status === "parsing" || !text.trim()}
            className="ui-button-primary h-10 shrink-0 px-4 text-sm"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
