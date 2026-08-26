import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/version";

// 公开接口：客户端轮询此接口实现"有新版本自动提示"
export async function GET() {
  return NextResponse.json({ version: APP_VERSION });
}
