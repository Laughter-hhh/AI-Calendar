// 服务器 AI 配置读取：优先环境变量，其次读取独立配置文件
// 配置文件默认 /opt/ai-calendar/config.env（在 app 目录之外，部署不会被覆盖）：
//   OPENAI_API_KEY=sk-xxx
//   OPENAI_BASE_URL=https://api.openai.com/v1
//   OPENAI_MODEL=gpt-4o-mini
//   OPENAI_STT_MODEL=whisper-1
import fs from "node:fs";

const CONFIG_PATH = process.env.AI_CONFIG_PATH ?? "/opt/ai-calendar/config.env";

function loadFileConfig(): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const text = fs.readFileSync(/* turbopackIgnore: true */ CONFIG_PATH, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !m[1].startsWith("#")) result[m[1]] = m[2];
    }
  } catch {
    // 配置文件不存在时忽略，仅用环境变量
  }
  return result;
}

export function getConfig(key: string): string | undefined {
  return process.env[key] ?? loadFileConfig()[key];
}
