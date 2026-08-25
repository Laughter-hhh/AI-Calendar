"use client";

import { useState } from "react";

export default function ExportButton({ from, to }: { from: string; to: string }) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const res = await fetch(`/api/events/export?from=${from}&to=${to}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-calendar-${from}-${to}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={download}
      disabled={busy}
      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
      title="导出为 .ics，可导入 Google Calendar / Apple 日历 / Outlook"
    >
      {busy ? "导出中…" : "导出 ICS"}
    </button>
  );
}
