// AI 服务层统一数据结构
// 上层（API 路由、前端）只依赖这里定义的类型，不关心具体使用哪个模型

/** 一个待创建/已创建的日程事件 */
export interface ParsedEvent {
  /** 事件标题 */
  title: string;
  /** 日期，格式 YYYY-MM-DD */
  date: string;
  /** 开始时间 HH:mm，null 表示全天 */
  time: string | null;
  /** 结束时间 HH:mm（可选） */
  endTime?: string | null;
  /** 备注（可选） */
  note?: string;
  /** 重复规则（未来扩展：daily / weekly / monthly） */
  repeat?: string | null;
}

/** AI 解析的完整结果 */
export interface ParseResult {
  /** 解析出的事件（可能为空，此时需要追问） */
  events: ParsedEvent[];
  /** 缺失的信息字段：title / date / time */
  missing: string[];
  /** 给用户看的一句话提示 */
  message: string;
}

/** 追问后用户补充的信息，与原文合并再次解析 */
export interface ParseContext {
  title?: string;
  date?: string;
  time?: string;
}

/** 所有解析器实现统一接口（模型可替换的关键） */
export interface AIParser {
  readonly name: string;
  parse(text: string, context?: ParseContext): Promise<ParseResult>;
}
