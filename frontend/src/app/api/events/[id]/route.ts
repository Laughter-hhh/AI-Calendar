import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteEvent, updateEvent } from "@/lib/events";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId)) return NextResponse.json({ error: "参数错误" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const event = updateEvent(user.id, eventId, {
    title: typeof body.title === "string" ? body.title : undefined,
    date: typeof body.date === "string" ? body.date : undefined,
    time: body.time !== undefined ? (typeof body.time === "string" && body.time ? body.time : null) : undefined,
    endTime: body.endTime !== undefined ? (typeof body.endTime === "string" && body.endTime ? body.endTime : null) : undefined,
    note: body.note !== undefined ? (typeof body.note === "string" && body.note ? body.note : null) : undefined,
    repeat: body.repeat !== undefined ? (typeof body.repeat === "string" && body.repeat ? body.repeat : null) : undefined,
  });

  if (!event) return NextResponse.json({ error: "事件不存在" }, { status: 404 });
  return NextResponse.json({ event });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId)) return NextResponse.json({ error: "参数错误" }, { status: 400 });

  const ok = deleteEvent(user.id, eventId);
  if (!ok) return NextResponse.json({ error: "事件不存在" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
