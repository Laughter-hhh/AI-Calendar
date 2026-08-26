// AI 服务层入口：选择模型，失败时自动回退到本地解析器
import { localParser } from "./providers/local";
import { OpenAICompatibleParser } from "./providers/openai";
import type { ParseContext, ParseResult } from "./types";
import { getConfig } from "./config";

export async function parseEvent(
  text: string,
  context?: ParseContext
): Promise<{ result: ParseResult; provider: string }> {
  // 配置了 API Key 时优先使用 AI 服务
  const apiKey = getConfig("OPENAI_API_KEY");
  if (apiKey) {
    try {
      const result = await new OpenAICompatibleParser({
        ...process.env,
        OPENAI_API_KEY: apiKey,
        OPENAI_BASE_URL: getConfig("OPENAI_BASE_URL") ?? process.env.OPENAI_BASE_URL,
        OPENAI_MODEL: getConfig("OPENAI_MODEL") ?? process.env.OPENAI_MODEL,
      }).parse(text, context);
      return { result, provider: "openai" };
    } catch (err) {
      console.error("AI 服务调用失败，已回退到本地解析器：", err);
    }
  }
  return { result: await localParser.parse(text, context), provider: localParser.name };
}
