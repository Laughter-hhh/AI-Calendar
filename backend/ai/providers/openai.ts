// OpenAI 兼容"标准化"提供者：
// 模型负责理解自然语言，把用户的话改写成本地规则可识别的标准句式；
// 固定程序（local.ts）再按标准句式生成日程（截止提醒/连续/重复/待办等确定性逻辑都在本地规则里）。
import type { ParseContext } from "../types";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

const NORMALIZE_SYSTEM = [
  "你是日程语句标准化助手。把用户的话改写成下面定义的唯一标准句式，只输出一行，不要解释、JSON、Markdown 或额外标点。",
  "缺少的日期、时间或重复规则直接省略，让后续程序追问；事项必须保留在最后。",
  "固定格式：日期 时间 事项；日期只能用 YYYY-MM-DD、今天、明天、后天；单时间只能用 HH:mm；时间段只能用 HH:mm-HH:mm（中间必须是半角连字符 -，禁止使用“到/至”）。",
  "- 定时：<日期> <时间或时间段> <事项>    例：2026-09-03 15:00 开会",
  "- 只有时间：<时间或时间段> <事项>      例：15:00-18:00 助教开会",
  "- 只有日期：<日期> <事项>      例：2026-09-03 开会",
  "- 待办（无日期无时间）：待办：<事项>    例：待办：交报告",
  "- 截止任务：<YYYY-MM-DD前>完成<事项>（保留“前”）    例：2026-08-31前完成年度审核",
  "- 连续：从<日期>开始连续N天 <时间或时间段> <事项>    例：从今天开始连续四天 20:00 学习 Python",
  "- 重复：每天 <时间或时间段> <事项> 或 每周X <时间或时间段> <事项> 或 每月N日 <时间或时间段> <事项>",
  "- 有起始日期和持续周数：从<日期>开始持续N周 每周X和周Y <时间或时间段> <事项>（例：从2026-09-10开始持续16周 每周四和周五 15:00-18:00 当助教）",
  "- 多个重复星期：每周X和周Y <时间或时间段> <事项>（保留在同一行，由程序拆成多个 weekly 事件；X/Y 只填星期几，不再重复“周”）",
  "- 本周多天一次性：本周周X和周Y <时间或时间段> <事项>（repeat 为空，不得改写成每周）",
  "- 复合安排：<日期> <时间段> <事项>；之后每周X和周Y <时间段> <事项>（例：2026-09-10 15:00-18:00 助教开会；之后每周四和周五 15:00-18:00 当助教）",
  "规则：",
  "1. 把中文数字日期转成阿拉伯数字（八月三十一 → 8月31日）；",
  "2. 时间统一为 24 小时制 HH:mm；范围统一为 HH:mm-HH:mm；（十五点到十八点 → 15:00-18:00）；",
  "3. 不要编造用户没说的日期/时间；不要解释；不要输出 JSON；",
  "3.1. ‘本周/这周’只表示当前这一周；出现多个星期几时必须保留为多个一次性日期，不得改写成‘每周’；",
  "3.2. ‘之后/然后每周周X和周Y’表示后半句的多个独立 weekly 事件，不能吞掉前半句的一次性事件；",
  "3.3. ‘从<日期>开始，持续N周’必须保留起始日期和持续周数，不能改成从今天开始或无截止日期；",
  "4. 只保留事项本身，去掉'我要/请/完成/进行'等口语词（截止任务的'完成'保留在'完成事项'结构里）。",
].join("\n");

export class OpenAICompatibleParser {
  readonly name = "openai-compatible";

  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.apiKey = env.OPENAI_API_KEY ?? "";
    this.baseUrl = (env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.model = env.OPENAI_MODEL ?? DEFAULT_MODEL;
  }

  /** 把用户自然语言改写为标准句式（本地规则可识别） */
  async normalize(text: string, context?: ParseContext): Promise<string> {
    const userContent =
      context && Object.keys(context).length > 0
        ? `已有信息（JSON）：${JSON.stringify(context)}\n用户最新输入：${text}`
        : text;

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: NORMALIZE_SYSTEM },
          { role: "user", content: userContent },
        ],
        temperature: 0,
      }),
    });

    if (!res.ok) {
      throw new Error(`AI 服务响应异常：${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI 服务返回内容为空");
    return content
      .replace(/^```[\s\S]*?```$/, "")
      .replace(/[。！？!?]$/, "")
      .trim();
  }
}
