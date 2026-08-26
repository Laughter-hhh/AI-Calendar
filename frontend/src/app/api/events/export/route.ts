// ICS 导出：把某日期区间的日程导出为 .ics 文件，可导入 Google Calendar / Apple 日历 / Outlook
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { getDb } from "@/lib/db";

function fmtDate(d: string): string {
  return d.replace(/-/g, "");
}

function fmtDateTime(d: string, t: string): string {
  return `${fmtDate(d)}T${t.replace(":", "")}00`;
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function rruleOf(repeat: string, repeatUntil: string | null): string | null {
  const freq = repeat === "daily" ? "DAILY" : repeat === "weekly" ? "WEEKLY" : repeat === "monthly" ? "MONTHLY" : null;
  if (!freq) return null;
  return `RRULE:FREQ=${freq}${repeatUntil ? `;UNTIL=${fmtDate(repeatUntil)}` : ""}`;
}

export async function GET(request: Request) {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    return NextResponse.json({ error: "日期区间参数不正确" }, { status: 400 });
  }

  const db = getDb();
  const single = db
    .prepare(
      `SELECT * FROM events
       WHERE user_id = ? AND repeat IS NULL AND event_date BETWEEN ? AND ?`
    )
    .all(user.id, from, to) as unknown as Array<Record<string, unknown>>;
  const recurring = db
    .prepare(
      `SELECT * FROM events
       WHERE user_id = ? AND repeat IS NOT NULL AND event_date <= ?
         AND (repeat_until IS NULL OR repeat_until >= ?)`
    )
    .all(user.id, to, from) as unknown as Array<Record<string, unknown>>;

  const exceptions = new Map<number, string[]>();
  const exRows = db
    .prepare("SELECT event_id, date FROM event_exceptions WHERE date BETWEEN ? AND ?")
    .all(from, to) as unknown as Array<{ event_id: number; date: string }>;
  for (const r of exRows) {
    const list = exceptions.get(Number(r.event_id)) ?? [];
    list.push(r.date);
    exceptions.set(Number(r.event_id), list);
  }

  const now = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const vevents: string[] = [];

  function pushVevent(row: Record<string, unknown>) {
    const id = Number(row.id);
    const date = String(row.event_date);
    const time = row.start_time === null ? null : String(row.start_time);
    const endTime = row.end_time === null ? null : String(row.end_time);
    const repeat = row.repeat === null ? null : String(row.repeat);
    const repeatUntil = row.repeat_until === null ? null : String(row.repeat_until);
    const note = row.note === null ? null : String(row.note);
    const exdates = exceptions.get(id) ?? [];

    const lines = [
      "BEGIN:VEVENT",
      `UID:${id}@ai-calendar`,
      `DTSTAMP:${now}`,
      `SUMMARY:${esc(String(row.title))}`,
    ];
    if (time) {
      lines.push(`DTSTART:${fmtDateTime(date, time)}`);
      if (endTime) lines.push(`DTEND:${fmtDateTime(date, endTime)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${fmtDate(date)}`);
    }
    if (note) lines.push(`DESCRIPTION:${esc(note)}`);
    if (Number(row.done) === 1) lines.push("STATUS:COMPLETED");
    const rrule = rruleOf(repeat ?? "", repeatUntil);
    if (rrule) lines.push(rrule);
    if (exdates.length > 0) {
      const ex = time
        ? exdates.map((d) => `EXDATE:${fmtDateTime(d, time)}`).join("\r\n")
        : exdates.map((d) => `EXDATE;VALUE=DATE:${fmtDate(d)}`).join("\r\n");
      lines.push(ex);
    }
    lines.push("END:VEVENT");
    vevents.push(lines.join("\r\n"));
  }

  for (const row of single) pushVevent(row);
  for (const row of recurring) pushVevent(row);

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AI Calendar//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="ai-calendar-${from}-${to}.ics"`,
    },
  });
}
