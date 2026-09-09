import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createCalendarMark, listCalendarMarks } from "@/lib/calendar-marks";
import type { CalendarMarkType } from "@/lib/calendar-mark-types";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { isValidDateStr, shiftDate, shiftMonth, todayStr } from "@/lib/date";

function currentMonthRange(): { from: string; to: string } {
  const today = todayStr();
  const from = `${today.slice(0, 7)}-01`;
  return { from, to: shiftDate(shiftMonth(from, 1), -1) };
}

export async function GET(request: Request) {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const url = new URL(request.url);
  const fallback = currentMonthRange();
  const from = url.searchParams.get("from") ?? fallback.from;
  const to = url.searchParams.get("to") ?? fallback.to;
  if (!isValidDateStr(from) || !isValidDateStr(to) || from > to) {
    return NextResponse.json({ error: "日期范围不正确" }, { status: 400 });
  }
  return NextResponse.json({ marks: listCalendarMarks(user.id, from, to) });
}

export async function POST(request: Request) {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const mark = createCalendarMark(user.id, {
      date: typeof body.date === "string" ? body.date : "",
      title: typeof body.title === "string" ? body.title : "",
      type: body.type as CalendarMarkType | undefined,
      note: body.note == null ? null : String(body.note),
    });
    return NextResponse.json({ mark }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "无法保存日历标记" }, { status: 400 });
  }
}
