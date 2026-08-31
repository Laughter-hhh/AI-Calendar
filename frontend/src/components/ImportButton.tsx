"use client";

import { useRef, useState } from "react";

interface ImportPreviewItem {
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
}

interface ImportPreview {
  ready: number;
  duplicates: number;
  failed: number;
  skipped: number;
  warnings: string[];
  preview: ImportPreviewItem[];
}

interface PendingImport {
  content: string;
  fileName: string;
  preview: ImportPreview;
}

export default function ImportButton() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState<PendingImport | null>(null);

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
      const preview = (await previewRes.json()) as ImportPreview & { error?: string };
      if (!previewRes.ok) {
        setMsg(preview.error ?? "无法读取日历文件");
        return;
      }
      if (preview.ready === 0) {
        setMsg(`没有可新增日程：重复 ${preview.duplicates} 条，无法识别 ${preview.failed} 条`);
        return;
      }
      setPending({ content, fileName: file.name, preview });
    } catch {
      setMsg("读取失败，请检查文件后重试");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function confirmImport() {
    if (!pending || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const importRes = await fetch("/api/events/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: pending.content,
          fileName: pending.fileName,
          mode: "import",
        }),
      });
      const result = await importRes.json();
      if (!importRes.ok) {
        setMsg(result.error ?? "导入失败");
        return;
      }
      setPending(null);
      setMsg(
        `导入完成：新增 ${result.imported} 条，重复跳过 ${result.duplicates} 条${result.failed ? `，无法识别 ${result.failed} 条` : ""}`
      );
      if (result.imported > 0) window.location.reload();
    } catch {
      setMsg("导入失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="shrink-0 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 md:px-3 md:py-2 md:text-sm"
          title="先预览再导入 .ics（Google Calendar / Apple 日历 / Outlook）"
        >
          {busy ? "读取中…" : "导入 .ics"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".ics,text/calendar"
          className="hidden"
          onChange={(event) => event.target.files?.[0] && void onFile(event.target.files[0])}
        />
        {msg && <span className="min-w-0 truncate text-xs text-zinc-500">{msg}</span>}
      </div>

      {pending && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-preview-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-black/35"
            aria-label="取消导入"
            onClick={() => {
              setPending(null);
              setMsg("已取消，原有日程未改变");
            }}
          />
          <section className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl md:rounded-2xl md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="import-preview-title" className="text-base font-semibold text-zinc-900">
                  导入前确认
                </h2>
                <p className="mt-0.5 truncate text-xs text-zinc-400" title={pending.fileName}>
                  {pending.fileName}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-zinc-100"
                aria-label="关闭"
                onClick={() => setPending(null)}
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-emerald-50 px-2 py-2">
                <p className="text-lg font-semibold text-emerald-700">{pending.preview.ready}</p>
                <p className="text-[11px] text-emerald-600">将新增</p>
              </div>
              <div className="rounded-xl bg-zinc-100 px-2 py-2">
                <p className="text-lg font-semibold text-zinc-700">{pending.preview.duplicates}</p>
                <p className="text-[11px] text-zinc-500">重复跳过</p>
              </div>
              <div className="rounded-xl bg-amber-50 px-2 py-2">
                <p className="text-lg font-semibold text-amber-700">{pending.preview.failed}</p>
                <p className="text-[11px] text-amber-600">无法识别</p>
              </div>
            </div>

            <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
              采用只追加策略：不会修改或删除任何原有日程；重复导入同一事件会自动跳过。
            </p>

            {pending.preview.warnings.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs font-medium text-amber-800">请留意</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-5 text-amber-700">
                  {pending.preview.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3">
              <p className="text-xs font-medium text-zinc-600">前 {pending.preview.preview.length} 条预览</p>
              <ul className="mt-1.5 divide-y divide-zinc-100 rounded-lg border border-zinc-200 px-3">
                {pending.preview.preview.map((event, index) => (
                  <li key={`${event.date}-${event.startTime}-${event.title}-${index}`} className="py-2">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className="shrink-0 text-xs font-medium text-zinc-700">
                        {event.startTime
                          ? `${event.startTime}${event.endTime ? `–${event.endTime}` : ""}`
                          : "全天"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-800" title={event.title}>
                        {event.title}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-zinc-400">{event.date}</p>
                  </li>
                ))}
              </ul>
            </div>

            {pending.preview.skipped > 0 && (
              <p className="mt-2 text-xs text-amber-600">
                文件超过单次上限，另有 {pending.preview.skipped} 条未处理。
              </p>
            )}
            {msg && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {msg}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void confirmImport()}
                disabled={busy}
                className="flex-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                {busy ? "导入中…" : `确认新增 ${pending.preview.ready} 条`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                  setMsg("已取消，原有日程未改变");
                }}
                disabled={busy}
                className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
              >
                取消
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
