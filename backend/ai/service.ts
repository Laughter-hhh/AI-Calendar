// AI 服务层入口：
// 1) 配置 Key 时：模型理解自然语言 → 改写成标准句式 → 本地固定程序生成日程
// 2) 未配置 Key 或模型失败时：直接用本地规则解析器
import { localParser } from "./providers/local";
import { isCompositeScheduleSentence, isDeadlineSentence } from "./providers/local";
import { OpenAICompatibleParser } from "./providers/openai";
import type { ParseContext, ParseResult } from "./types";
import { getConfig } from "./config";

/** 本周是有限日期范围；即使模型改写成“每周”，也必须回到原句走确定性解析。 */
function isFiniteCurrentWeekSentence(text: string): boolean {
  return /(?:本|这)(?:周|星期|礼拜)/.test(text) && !/(?:每(?:周|星期|礼拜)|每天|每日|重复|持续)/.test(text);
}

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
        // 防模型过度解读：原句没有"前/之前/截止"时，去掉标准句里被模型强加的"前/之前"
        // （例：八月三十一完成年度审核 → 8.31 全天待办，而不是截止提醒）
        const safeCanonical = !isDeadlineSentence(text)
          ? canonical.replace(
              /((?:[零一二两三四五六七八九十\d]{1,3})月(?:[零一二两三四五六七八九十\d]{1,3})[日号]?)(?:前|之前)/g,
              "$1"
            )
          : canonical;
        const result = await localParser.parse(
          isFiniteCurrentWeekSentence(text) || isCompositeScheduleSentence(text) ? text : safeCanonical,
          context
        );
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
