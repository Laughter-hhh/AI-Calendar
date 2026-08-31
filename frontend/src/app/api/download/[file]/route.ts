// 提供安卓 APK 等下载文件：文件存放在服务器 DOWNLOADS_DIR（默认 /opt/ai-calendar/downloads）
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const name = path.basename(file);
  // 防目录穿越：只允许普通文件名
  if (!/^[\w.-]+$/.test(name)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const dir = process.env.DOWNLOADS_DIR ?? "/opt/ai-calendar/downloads";
  const filePath = path.join(/* turbopackIgnore: true */ dir, name);
  if (
    !fs.existsSync(/* turbopackIgnore: true */ filePath) ||
    !fs.statSync(/* turbopackIgnore: true */ filePath).isFile()
  ) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const body = Readable.toWeb(
    fs.createReadStream(/* turbopackIgnore: true */ filePath)
  ) as ReadableStream;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
