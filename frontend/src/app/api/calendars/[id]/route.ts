import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteCalendar, updateCalendar } from "@/lib/calendars";
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
    const calendar = updateCalendar(user.id, id, { name: body.name, color: body.color });
    if (!calendar) return NextResponse.json({ error: "日历不存在" }, { status: 404 });
    return NextResponse.json({ calendar });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "无法修改日历" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  try {
    if (!deleteCalendar(user.id, id)) return NextResponse.json({ error: "日历不存在" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "无法删除日历" }, { status: 400 });
  }
}
