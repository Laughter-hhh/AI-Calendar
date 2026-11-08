import { getConfig } from "../../../backend/ai/config";

function publicBaseUrl(): string | null {
  const configured = getConfig("PASSWORD_RESET_BASE_URL");
  if (!configured) return null;
  try {
    const url = new URL(configured);
    const localDevelopment = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !localDevelopment) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function isPasswordResetEmailConfigured(): boolean {
  return Boolean(getConfig("RESEND_API_KEY") && getConfig("PASSWORD_RESET_FROM") && publicBaseUrl());
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const apiKey = getConfig("RESEND_API_KEY");
  const from = getConfig("PASSWORD_RESET_FROM");
  const baseUrl = publicBaseUrl();
  if (!apiKey || !from || !baseUrl) throw new Error("密码重置邮件服务未配置");

  const link = new URL("/reset-password", baseUrl);
  // Keep the secret out of HTTP requests, server access logs, and referrer headers.
  link.hash = new URLSearchParams({ token }).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "AI Calendar 密码重置",
        text: `有人请求重置此 AI Calendar 账号的密码。请在 30 分钟内打开以下链接设置新密码：\n\n${link.toString()}\n\n如果不是你本人操作，请忽略此邮件。`,
        html: `<p>有人请求重置此 AI Calendar 账号的密码。</p><p><a href="${link.toString()}">在 30 分钟内设置新密码</a></p><p>如果不是你本人操作，请忽略此邮件。</p>`,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`重置邮件发送失败：${response.status}`);
  } finally {
    clearTimeout(timer);
  }
}
