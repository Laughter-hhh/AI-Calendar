import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createNote, listNotes } from "@/lib/notes";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";

export async function GET() {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  return NextResponse.json({ notes: listNotes(user.id) });
}

export async function POST(request: Request) {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "写点内容再添加吧" }, { status: 400 });
  }
  if (text.length > 500) {
    return NextResponse.json({ error: "内容太长了，最多 500 字" }, { status: 400 });
  }

  const note = createNote(user.id, text);
  return NextResponse.json({ note }, { status: 201 });
}
