import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createCalendar, listCalendars } from "@/lib/calendars";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";

export async function GET() {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  return NextResponse.json({ calendars: listCalendars(user.id) });
}

export async function POST(request: Request) {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const calendar = createCalendar(user.id, typeof body.name === "string" ? body.name : "", typeof body.color === "string" ? body.color : "blue");
    return NextResponse.json({ calendar }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "无法创建日历" }, { status: 400 });
  }
}
