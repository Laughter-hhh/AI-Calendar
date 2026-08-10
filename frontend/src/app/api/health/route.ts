import { NextResponse } from "next/server";

// 部署健康检查：浏览器访问 /api/health 返回 JSON 即表示服务正常
export async function GET() {
  return NextResponse.json({
    ok: true,
    name: "ai-calendar",
    time: new Date().toISOString(),
  });
}
