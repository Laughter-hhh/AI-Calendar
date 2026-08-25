// ICS 导入：解析 .ics 文件内容，把 VEVENT 转换为日程（与 /export 形成互通闭环）
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { createEvent } from "@/lib/events";

const MAX_EVENTS = 200;

function unfold(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseVevent(block: string) {
  const props = new Map<string, string>();
  for (const line of unfold(block.split(/\r?\n/))) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    props.set(line.slice(0, idx).toUpperCase(), line.slice(idx + 1));
  }

  const title = props.get("SUMMARY")?.trim();
  const dtstart = props.get("DTSTART");
  if (!title || !dtstart) return null;

  const m = dtstart.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  const time = m[4] ? `${m[4]}:${m[5]}` : null;

  // 结束时间仅在同一日期时导入（跨天事件暂按全天处理由客户端修正）
  let endTime: string | null = null;
  const dtend = props.get("DTEND");
  if (dtend) {
    const em = dtend.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
    if (em && em[1] === m[1] && em[2] === m[2] && em[3] === m[3]) endTime = `${em[4]}:${em[5]}`;
  }

  let repeat: string | null = null;
  let repeatUntil: string | null = null;
  const rrule = props.get("RRULE");
  if (rrule) {
    const freq = rrule.match(/FREQ=(\w+)/);
    if (freq) {
      const f = freq[1].toUpperCase();
      if (f === "DAILY") repeat = "daily";
      else if (f === "WEEKLY") repeat = "weekly";
      else if (f === "MONTHLY") repeat = "monthly";
    }
    const until = rrule.match(/UNTIL=(\d{4})(\d{2})(\d{2})/);
    if (until) repeatUntil = `${until[1]}-${until[2]}-${until[3]}`;
  }

  const note = props.get("DESCRIPTION")?.replace(/\\n/g, "\n").trim() || null;
  return { title, date, time, endTime, note, repeat, repeatUntil };
}

export async function POST(request: Request) {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content : "";
  if (!content.trim()) return NextResponse.json({ error: "内容为空" }, { status: 400 });

  const blocks = content.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
  let imported = 0;
  let failed = 0;
  for (const block of blocks.slice(0, MAX_EVENTS)) {
    const ev = parseVevent(block);
    if (!ev) {
      failed += 1;
      continue;
    }
    try {
      createEvent(user.id, { ...ev, sourceText: "ICS 导入" });
      imported += 1;
    } catch {
      failed += 1;
    }
  }
  const skipped = Math.max(0, blocks.length - MAX_EVENTS);
  return NextResponse.json({ imported, failed, skipped });
}
