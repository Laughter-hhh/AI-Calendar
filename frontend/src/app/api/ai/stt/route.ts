// 语音转文字：把手机端录制的音频交给 OpenAI 兼容的 /audio/transcriptions 识别
// 需要配置 OPENAI_API_KEY；未配置时返回 503（桌面 Chrome/Edge 仍可用浏览器内置语音）
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("audio");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return NextResponse.json({ error: "缺少音频文件" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "未配置语音识别服务（OPENAI_API_KEY）。请在服务器配置后使用，或改用桌面 Chrome/Edge 的浏览器语音。" },
      { status: 503 }
    );
  }

  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.OPENAI_STT_MODEL ?? "whisper-1";

  const body = new FormData();
  body.append("file", file as Blob, "recording.webm");
  body.append("model", model);

  try {
    const res = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
    });
    if (!res.ok) {
      return NextResponse.json({ error: `语音识别服务异常：${res.status}` }, { status: 502 });
    }
    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "未能识别出内容，请重试" }, { status: 422 });
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "语音识别服务不可达" }, { status: 502 });
  }
}
