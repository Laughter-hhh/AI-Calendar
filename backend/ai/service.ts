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

/** 明确说“每周”的语句必须保持 weekly 语义，不能被模型改写成本周一次性事项。 */
function hasExplicitWeeklyRule(text: string): boolean {
  return /每(?:周|星期|礼拜)/.test(text) && !/(?:本|这)(?:周|星期|礼拜)/.test(text);
}

/** “持续 N 周”由本地规则计算截止日，避免模型漏掉重复周期边界。 */
function hasWeeklyDuration(text: string): boolean {
  return /持续\s*[零一二两三四五六七八九十百\d]+\s*周/.test(text);
}

/** 时间段是确定性字段；若模型标准化丢掉结束时间，必须回到原句校正。 */
function hasTimeRange(text: string): boolean {
  return /(?:\d{1,2}:\d{2}\s*(?:到|至|~|－|—|-|–)\s*\d{1,2}:\d{2})|(?:[零一二两三四五六七八九十\d]{1,3})[点时][零一二两三四五六七八九十\d]{0,2}分?(?:到|至|~|－|—|-)\s*(?:[零一二两三四五六七八九十\d]{1,3})[点时]/.test(
    text
  );
}

function needsOriginalDeterministicParse(input: string, result: ParseResult): boolean {
  if (hasTimeRange(input) && result.events.some((event) => event.time !== null && !event.endTime)) return true;
  if (hasExplicitWeeklyRule(input) && result.events.length > 0 && result.events.every((event) => event.repeat !== "weekly")) return true;
  if (hasWeeklyDuration(input)) return true;
  return false;
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
        let result = await localParser.parse(
          isFiniteCurrentWeekSentence(text) || isCompositeScheduleSentence(text) ? text : safeCanonical,
          context
        );
        // AI 输出若违反时间段/明确每周的确定性语义，回到原句重算，避免错误结果进入保存流程。
        if (needsOriginalDeterministicParse(text, result)) {
          result = await localParser.parse(text, context);
        }
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
