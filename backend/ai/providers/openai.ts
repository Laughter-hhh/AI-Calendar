// OpenAI 兼容解析器：任何兼容 /chat/completions 的服务都可以接入
import type { AIParser, ParseContext, ParseResult } from "../types";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

export class OpenAICompatibleParser implements AIParser {
  readonly name = "openai-compatible";

  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.apiKey = env.OPENAI_API_KEY ?? "";
    this.baseUrl = (env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.model = env.OPENAI_MODEL ?? DEFAULT_MODEL;
  }

  async parse(text: string, context?: ParseContext): Promise<ParseResult> {
    const system = [
      "你是日历事件解析助手。把用户的中文自然语言转换成结构化日程。",
      "规则：",
      "1. 信息缺失时不要猜测，把缺失字段名称（title/date/time）放入 missing 数组；",
      "2. 相对日期（今天/明天/下周一）要转换成具体 YYYY-MM-DD；",
      "3. 时间用 24 小时制 HH:mm，全天事件用 null；",
      "4. '连续N天' 生成 N 个日期连续的事件；",
      "5. 只输出 JSON，不要输出其他文字。",
      "输出格式：",
      '{"events":[{"title":"","date":"YYYY-MM-DD","time":"HH:mm或null","endTime":"HH:mm或null","note":"","repeat":null}],"missing":[],"message":"给用户的一句话"}',
    ].join("\n");

    const userContent = context && Object.keys(context).length > 0
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
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
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
    return JSON.parse(content) as ParseResult;
  }
}
