import { NextResponse } from "next/server";
import { createPasswordResetToken } from "@/lib/auth";
import { isPasswordResetEmailConfigured, sendPasswordResetEmail } from "@/lib/password-reset-email";

const requests = new Map<string, number[]>();
const WINDOW_MS = 15 * 60_000;
const MAX_EMAIL_REQUESTS = 3;
const MAX_IP_REQUESTS = 20;

export async function POST(request: Request) {
  if (!isPasswordResetEmailConfigured()) {
    return NextResponse.json({ error: "密码重置服务尚未配置，请联系管理员" }, { status: 503 });
  }
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "请输入有效邮箱地址" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const keys = [`email:${email}`, `ip:${ip}`];
  const now = Date.now();
  if (requests.size > 10_000) {
    for (const [savedKey, times] of requests) {
      if (times.every((time) => now - time >= WINDOW_MS)) requests.delete(savedKey);
    }
  }
  const recentByEmail = (requests.get(keys[0]) ?? []).filter((time) => now - time < WINDOW_MS);
  const recentByIp = (requests.get(keys[1]) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recentByEmail.length >= MAX_EMAIL_REQUESTS || recentByIp.length >= MAX_IP_REQUESTS) {
    return NextResponse.json({ message: "如果该邮箱已注册，你将收到密码重置邮件；请检查收件箱和垃圾邮件。" });
  }
  requests.set(keys[0], [...recentByEmail, now]);
  requests.set(keys[1], [...recentByIp, now]);

  const token = createPasswordResetToken(email);
  if (token) {
    try {
      await sendPasswordResetEmail(email, token);
    } catch (error) {
      // 防止邮件服务故障暴露账号是否存在，错误只在服务端记录不含邮箱和令牌。
      console.error("密码重置邮件发送失败", error instanceof Error ? error.message : "未知错误");
    }
  }
  return NextResponse.json({ message: "如果该邮箱已注册，你将收到密码重置邮件；请检查收件箱和垃圾邮件。" });
}
