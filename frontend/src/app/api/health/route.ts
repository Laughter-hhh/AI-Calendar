import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// 部署健康检查：浏览器访问 /api/health 返回 JSON 即表示服务正常
export async function GET() {
  let db = "ok";
  try {
    getDb().prepare("SELECT 1").get();
  } catch {
    db = "error";
  }
  return NextResponse.json({
    ok: true,
    name: "ai-calendar",
    time: new Date().toISOString(),
    db,
    storage: "sqlite",
    sync: { metadata: true, cloud: false },
  }, { status: db === "ok" ? 200 : 503 });
}
