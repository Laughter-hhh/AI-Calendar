import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteCalendarMark, updateCalendarMark } from "@/lib/calendar-marks";
import type { CalendarMarkType } from "@/lib/calendar-mark-types";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  try {
    const mark = updateCalendarMark(user.id, id, {
      date: body.date,
      title: body.title,
      type: body.type as CalendarMarkType | undefined,
      note: body.note,
    });
    if (!mark) return NextResponse.json({ error: "日历标记不存在" }, { status: 404 });
    return NextResponse.json({ mark });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "无法保存日历标记" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  if (!deleteCalendarMark(user.id, id)) return NextResponse.json({ error: "日历标记不存在" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
