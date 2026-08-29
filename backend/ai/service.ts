// AI 服务层入口：
// 1) 配置 Key 时：模型理解自然语言 → 改写成标准句式 → 本地固定程序生成日程
// 2) 未配置 Key 或模型失败时：直接用本地规则解析器
import { localParser } from "./providers/local";
import { OpenAICompatibleParser } from "./providers/openai";
import type { ParseContext, ParseResult } from "./types";
import { getConfig } from "./config";

export async function parseEvent(
  text: string,
  context?: ParseContext
): Promise<{ result: ParseResult; provider: string }> {
  // 配置了 API Key 时：模型理解 + 标准化，固定程序执行
  const apiKey = getConfig("OPENAI_API_KEY");
  if (apiKey) {
    try {
      const parser = new OpenAICompatibleParser({
        ...process.env,
        OPENAI_API_KEY: apiKey,
        OPENAI_BASE_URL: getConfig("OPENAI_BASE_URL") ?? process.env.OPENAI_BASE_URL,
        OPENAI_MODEL: getConfig("OPENAI_MODEL") ?? process.env.OPENAI_MODEL,
      });
      const canonical = await parser.normalize(text, context);
      if (canonical) {
        const result = await localParser.parse(canonical, context);
        // 只要标准化结果可用（有事件或需要追问），就使用它
        if (result.events.length > 0 || result.missing.length > 0) {
          return { result, provider: "openai" };
        }
      }
    } catch (err) {
      console.error("AI 标准化失败，已回退到本地解析器：", err);
    }
  }
  return { result: await localParser.parse(text, context), provider: localParser.name };
}
