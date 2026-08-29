// OpenAI 兼容解析器：任何兼容 /chat/completions 的服务都可以接入
import type { AIParser, ParseContext, ParseResult } from "../types";
import { cleanTitle, resolveDate, resolveTime } from "./local";
import { todayStr } from "../date-utils";

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
      `今天是 ${todayStr()}（中国时区）。相对日期（今天/明天/后天/下周一）必须按这个今天换算成具体的 YYYY-MM-DD。`,
      "规则：",
      "1. 必须把相对日期（今天/明天/后天/下周一）换算成具体日期，输出严格 YYYY-MM-DD；",
      "2. 时间必须输出严格 24 小时制 HH:mm（例如 08:30、15:00），全天事件用 null；",
      "3. 日期/时间都缺失时，才把缺失字段名（title/date/time）放入 missing；",
      "4. '连续N天' 生成 N 个日期连续的事件；",
      "5. 如果用户说'X月Y日前/之前完成XX'这类截止任务：返回 4 个事件（截止前7/3/1天和当天，标题分别为'距离XX还有七天/三天/一天'和'今天截止：XX'，截止日为 Y-1，均无时间）；",
      "6. 只输出 JSON，不要输出任何其他文字。",
      "输出格式：",
      '{"events":[{"title":"","date":"YYYY-MM-DD","time":"HH:mm或null","endTime":"HH:mm或null","note":"","repeat":null,"repeatUntil":null}],"missing":[],"message":"给用户的一句话"}',
      "示例：",
      '输入：明天下午三点开会',
      '输出：{"events":[{"title":"开会","date":"2026-08-29","time":"15:00","endTime":null,"note":null,"repeat":null,"repeatUntil":null}],"missing":[],"message":"已为你安排好日程，确认后保存。"}',
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
    // 兼容模型输出带 ```json 代码块围栏的情况
    const jsonText = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const result = JSON.parse(jsonText) as ParseResult;
    return normalizeResult(result);
  }
}

/** 校正模型输出：相对日期/时间不规范时用本地规则兜底；仍无效则转为追问，避免脏数据 */
function normalizeResult(result: ParseResult): ParseResult {
  const events = (result.events ?? []).map((ev) => {
    const out = { ...ev };
    if (out.title) out.title = cleanTitle(out.title);
    if (out.date && !/^\d{4}-\d{2}-\d{2}$/.test(out.date)) {
      const d = resolveDate(out.date);
      if (d) out.date = d.date;
    }
    if (out.time && !/^\d{2}:\d{2}$/.test(out.time)) {
      const t = resolveTime(out.time);
      if (t.time) out.time = t.time;
    }
    return out;
  });

  const first = events[0];
  const missing = new Set<string>(result.missing ?? []);
  if (!first?.title) missing.add("title");
  if (!first?.date || !/^\d{4}-\d{2}-\d{2}$/.test(first.date)) missing.add("date");
  if (!first?.time || !/^\d{2}:\d{2}$/.test(first.time)) missing.add("time");

  if (missing.size > 0) {
    const names: Record<string, string> = { title: "做什么", date: "哪天", time: "几点" };
    return {
      events: first ? [first] : [],
      missing: [...missing],
      message: `还差一点信息：${[...missing].map((k) => names[k]).join("、")}。请告诉我。`,
    };
  }

  return { events, missing: [], message: result.message || "已为你安排好日程，确认后保存。" };
}
