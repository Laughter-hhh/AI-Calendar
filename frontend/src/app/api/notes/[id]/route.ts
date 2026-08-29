import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteNote, updateNote } from "@/lib/notes";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { id } = await params;
  const noteId = Number(id);
  if (!Number.isInteger(noteId)) return NextResponse.json({ error: "参数错误" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const note = updateNote(user.id, noteId, {
    text: typeof body.text === "string" ? body.text : undefined,
    done: body.done !== undefined ? body.done === true : undefined,
  });
  if (!note) return NextResponse.json({ error: "笔记本条目不存在" }, { status: 404 });
  return NextResponse.json({ note });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { id } = await params;
  const noteId = Number(id);
  if (!Number.isInteger(noteId)) return NextResponse.json({ error: "参数错误" }, { status: 400 });

  const ok = deleteNote(user.id, noteId);
  if (!ok) return NextResponse.json({ error: "笔记本条目不存在" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
