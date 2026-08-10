import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createEvent, listEvents } from "@/lib/events";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { todayStr } from "@/lib/date";

export async function GET(request: Request) {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? todayStr();
  return NextResponse.json({ events: listEvents(user.id, date) });
}

export async function POST(request: Request) {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const date = typeof body.date === "string" ? body.date : "";
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "缺少标题或日期格式不正确" }, { status: 400 });
  }

  const event = createEvent(user.id, {
    title,
    date,
    time: typeof body.time === "string" && body.time ? body.time : null,
    endTime: typeof body.endTime === "string" && body.endTime ? body.endTime : null,
    note: typeof body.note === "string" && body.note ? body.note : null,
    repeat: typeof body.repeat === "string" && body.repeat ? body.repeat : null,
    sourceText: typeof body.sourceText === "string" && body.sourceText ? body.sourceText : null,
  });
  return NextResponse.json({ event }, { status: 201 });
}
