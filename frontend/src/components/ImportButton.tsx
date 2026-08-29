"use client";

import { useRef, useState } from "react";

export default function ImportButton() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function onFile(file: File) {
    setBusy(true);
    setMsg("");
    try {
      const content = await file.text();
      const res = await fetch("/api/events/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "导入失败");
        return;
      }
      setMsg(`导入完成：成功 ${data.imported} 条，失败 ${data.failed} 条${data.skipped ? `，跳过 ${data.skipped} 条` : ""}`);
      if (data.imported > 0) window.location.reload();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="shrink-0 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 md:px-3 md:py-2 md:text-sm"
        title="导入 .ics 文件（Google Calendar / Apple 日历 / Outlook 导出）"
      >
        {busy ? "…" : "导入"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".ics,text/calendar"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      {msg && <span className="text-xs text-zinc-500">{msg}</span>}
    </div>
  );
}
