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
      if (!file.name.toLowerCase().endsWith(".ics")) {
        setMsg("仅支持 .ics 日历文件");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setMsg("文件过大，请选择 5MB 以内的 .ics 文件");
        return;
      }
      const content = await file.text();
      const previewRes = await fetch("/api/events/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, fileName: file.name, mode: "preview" }),
      });
      const preview = await previewRes.json();
      if (!previewRes.ok) {
        setMsg(preview.error ?? "无法读取日历文件");
        return;
      }
      if (preview.ready === 0) {
        setMsg(`没有可新增日程：重复 ${preview.duplicates} 条，无法识别 ${preview.failed} 条`);
        return;
      }
      const sample = (preview.preview as Array<{ title: string; date: string; startTime: string | null }>)
        .map((event) => `${event.date} ${event.startTime ?? "全天"} ${event.title}`)
        .join("\n");
      const confirmed = window.confirm(
        [
          `将新增 ${preview.ready} 条日程，跳过重复 ${preview.duplicates} 条，无法识别 ${preview.failed} 条。`,
          "只会追加，不会修改或删除现有日程。",
          sample ? `\n预览：\n${sample}` : "",
          "\n确定导入吗？",
        ].join("\n")
      );
      if (!confirmed) {
        setMsg("已取消，原有日程未改变");
        return;
      }

      const importRes = await fetch("/api/events/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, fileName: file.name, mode: "import" }),
      });
      const result = await importRes.json();
      if (!importRes.ok) {
        setMsg(result.error ?? "导入失败");
        return;
      }
      setMsg(
        `导入完成：新增 ${result.imported} 条，重复跳过 ${result.duplicates} 条${result.failed ? `，无法识别 ${result.failed} 条` : ""}`
      );
      if (result.imported > 0) window.location.reload();
    } catch {
      setMsg("导入失败，请检查文件后重试");
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
        title="先预览再导入 .ics（Google Calendar / Apple 日历 / Outlook）"
      >
        {busy ? "…" : "导入"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".ics,text/calendar;charset=utf-8"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      {msg && <span className="text-xs text-zinc-500">{msg}</span>}
    </div>
  );
}
