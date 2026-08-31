import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { existingExternalUids, importEvents } from "@/lib/events";
import { parseIcs } from "@/lib/ics";

const MAX_EVENTS = 1000;
const MAX_CONTENT_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content : "";
  const mode = body.mode === "preview" ? "preview" : "import";
  if (!content.trim()) return NextResponse.json({ error: "文件内容为空" }, { status: 400 });
  if (Buffer.byteLength(content, "utf8") > MAX_CONTENT_BYTES) {
    return NextResponse.json({ error: "文件过大，请选择 5MB 以内的 .ics 文件" }, { status: 413 });
  }

  const parsed = parseIcs(content, MAX_EVENTS);
  if (parsed.total === 0) {
    return NextResponse.json({ error: "未找到日历事件，请选择有效的 .ics 文件" }, { status: 400 });
  }

  const existing = existingExternalUids(user.id, parsed.events.map((event) => event.externalUid));
  const ready = parsed.events.filter((event) => !existing.has(event.externalUid));
  const baseDuplicates = parsed.duplicatesInFile + existing.size;
  const common = {
    format: "ics",
    policy: "append-only",
    total: parsed.total,
    ready: ready.length,
    duplicates: baseDuplicates,
    failed: parsed.failed,
    skipped: parsed.skippedByLimit,
    warnings: parsed.warnings,
  };

  if (mode === "preview") {
    return NextResponse.json({
      ...common,
      preview: ready.slice(0, 5).map((event) => ({
        title: event.title,
        date: event.date,
        startTime: event.time,
        endTime: event.endTime ?? null,
      })),
    });
  }

  const result = importEvents(user.id, ready);
  return NextResponse.json({
    ...common,
    imported: result.imported,
    duplicates: baseDuplicates + result.duplicates,
  });
}
