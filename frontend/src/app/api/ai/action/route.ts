import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { listEventsRange } from "@/lib/events";
import { resolveAction } from "../../../../../../backend/ai/action";

export async function POST(request: Request) {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "请输入想做的事情" }, { status: 400 });

  const result = resolveAction(text, (from, to) =>
    listEventsRange(user.id, from, to).map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      time: e.startTime,
      repeat: e.repeat,
      repeatUntil: e.repeatUntil,
    }))
  );
  return NextResponse.json({ result });
}
