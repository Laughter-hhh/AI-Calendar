import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8 || password.length > 256) {
    return NextResponse.json({ error: "新密码需为 8–256 个字符" }, { status: 400 });
  }
  const reset = resetPasswordWithToken(token, password);
  if (!reset) return NextResponse.json({ error: "重置链接无效或已过期，请重新申请" }, { status: 400 });
  return NextResponse.json({ ok: true, message: "密码已重置，请使用新密码登录" });
}
