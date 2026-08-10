// 本地规则解析器：不依赖网络和 API Key
// 用正则把常见的中文时间表达解析成结构化事件，保证 MVP 在没有 AI 服务时也能跑通
import type { AIParser, ParseContext, ParsedEvent, ParseResult } from "../types";
import { addDaysStr, todayStr, weekdayOf } from "../date-utils";

const CHINESE_NUM: Record<string, number> = {
  零: 0, 一: 1, 两: 2, 二: 2, 三: 3, 四: 4,
  五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

const WEEKDAY_NAME: Record<string, number> = {
  日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** 把 "四" / "14" / "十四" 转成数字 */
function cnToNumber(s: string): number | null {
  const n = Number(s);
  if (!Number.isNaN(n)) return n;
  let total = 0;
  let current = 0;
  for (const ch of s) {
    if (ch === "十") {
      total += (current || 1) * 10;
      current = 0;
    } else if (ch === "百") {
      total += (current || 1) * 100;
      current = 0;
    } else if (CHINESE_NUM[ch] !== undefined) {
      current = CHINESE_NUM[ch];
    } else {
      return null;
    }
  }
  total += current;
  return total > 0 ? total : null;
}

/** 解析日期表达，返回 { date, 去掉日期词后的剩余文本 } */
function resolveDate(text: string): { date: string; rest: string } | null {
  let rest = text;

  // 同时吞掉 "从…开始" 这类前缀：从今天开始 → 今天
  const relative = rest.match(/(?:从)?(?:今天|今日|明天|明日|后天)(?:开始)?/);
  if (relative) {
    const days = /后天/.test(relative[0]) ? 2 : /明天|明日/.test(relative[0]) ? 1 : 0;
    rest = rest.replace(relative[0], " ");
    return { date: addDaysStr(todayStr(), days), rest: rest.replace(/\s+/g, " ").trim() };
  }

  const weekday = rest.match(/(下|这)?(?:周|星期|礼拜)([日天一二三四五六])/);
  if (weekday) {
    const target = WEEKDAY_NAME[weekday[2]];
    let diff = (target - weekdayOf(todayStr()) + 7) % 7;
    if (weekday[1] === "下") diff += 7;
    rest = rest.replace(weekday[0], " ");
    return { date: addDaysStr(todayStr(), diff), rest: rest.replace(/\s+/g, " ").trim() };
  }

  const monthDay = rest.match(/(\d{1,2})月(\d{1,2})[日号]?/);
  if (monthDay) {
    const month = Number(monthDay[1]);
    const day = Number(monthDay[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = Number(todayStr().slice(0, 4));
      rest = rest.replace(monthDay[0], " ");
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { date: addDaysStr(dateStr, 0), rest: rest.replace(/\s+/g, " ").trim() };
    }
  }

  return null;
}

/** 解析时间表达，返回 { time, endTime, 去掉时间词后的剩余文本 } */
function resolveTime(text: string): { time: string | null; endTime: string | null; rest: string } {
  let rest = text;
  let time: string | null = null;
  let endTime: string | null = null;

  // 时间段：3点到5点 / 14:00-16:00 / 两点至四点
  const range = rest.match(
    /([零一二两三四五六七八九十\d]{1,3})[点时]([零一二三四五六七八九十\d]{1,2})?分?(?:到|至|~|－|—|-)(\d{1,2}|[零一二三四五六七八九十]{1,3})[点时]([零一二三四五六七八九十\d]{1,2})?分?/
  );
  if (range) {
    const h1 = cnToNumber(range[1]);
    const m1 = range[2] ? cnToNumber(range[2]) : 0;
    const h2 = cnToNumber(range[3]);
    const m2 = range[4] ? cnToNumber(range[4]) : 0;
    if (h1 !== null && h2 !== null && m1 !== null && m2 !== null) {
      time = `${pad2(h1)}:${pad2(m1)}`;
      endTime = `${pad2(h2)}:${pad2(m2)}`;
      rest = rest.replace(range[0], " ");
    }
  }

  // 单个时间：15:30 / 下午3点30分 / 晚上八点 / 三点半
  if (!time) {
    const clock = rest.match(/(\d{1,2}):(\d{1,2})/);
    if (clock) {
      time = `${pad2(Number(clock[1]))}:${pad2(Number(clock[2]))}`;
      rest = rest.replace(clock[0], " ");
    } else {
      const cn = rest.match(/([零一二两三四五六七八九十\d]{1,3})[点时]([零一二三四五六七八九十\d]{1,2})?分?/);
      const half = !cn ? rest.match(/([零一二两三四五六七八九十\d]{1,3})点半/) : null;
      const m = cn ?? half;
      if (m) {
        const hour = cnToNumber(m[1]);
        let minute = 0;
        if (half) minute = 30;
        else if (m[2]) minute = cnToNumber(m[2]) ?? 0;
        if (hour !== null) {
          let h = hour;
          const meridiem = rest.match(/凌晨|清晨|早上|早晨|上午|中午|午间|下午|傍晚|晚上|晚间|夜里|夜晚|晚/);
          if (meridiem) {
            const p = meridiem[0];
            if (p === "中午" || p === "午间") h = 12;
            else if (p === "下午" || p === "傍晚" || p === "晚上" || p === "晚间" || p === "夜里" || p === "夜晚" || p === "晚") {
              if (h < 12) h += 12;
            }
          }
          time = `${pad2(h % 24)}:${pad2(minute)}`;
          rest = rest.replace(m[0], " ");
        }
      }
    }
  }

  if (time) {
    // 清理残留的时段词（如 "下午" 单独留在标题里）
    rest = rest.replace(/凌晨|清晨|早上|早晨|上午|中午|午间|下午|傍晚|晚上|晚间|夜里|夜晚/g, " ");
  }
  return { time, endTime, rest: rest.replace(/\s+/g, " ").trim() };
}

/** 清洗标题：去掉口语前缀和标点 */
function cleanTitle(raw: string): string {
  return raw
    .replace(/^(我要|我想|帮我|请|安排一下|安排|预约|定个|记下|添加|加上|从|开始)/, "")
    .replace(/[。！？!?，,；;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const localParser: AIParser = {
  name: "local-rule-based",

  parse(text: string, context?: ParseContext): Promise<ParseResult> {
    const input = text.trim();
    let rest = input;

    // 1. 连续 N 天（例：从今天开始连续四天晚上八点学习 Python）
    let repeatDays = 0;
    const repeatMatch = rest.match(/连续([零一二两三四五六七八九十\d]+)天/);
    if (repeatMatch) {
      const n = cnToNumber(repeatMatch[1]);
      if (n !== null && n >= 1 && n <= 30) {
        repeatDays = n;
        rest = rest.replace(repeatMatch[0], " ");
      }
    }

    // 2. 重复规则（每天/每周/每月，展开功能未来版本实现）
    let repeat: string | null = null;
    if (/每天|每日|每晚/.test(rest)) repeat = "daily";
    else if (/每周/.test(rest)) repeat = "weekly";
    else if (/每月/.test(rest)) repeat = "monthly";
    if (repeat) rest = rest.replace(/每天|每日|每晚|每周|每月/g, " ");

    // 3. 日期
    const resolvedDate = resolveDate(rest);
    const date = context?.date ?? resolvedDate?.date ?? null;
    if (resolvedDate) rest = resolvedDate.rest;

    // 4. 时间
    const resolvedTime = resolveTime(rest);
    const time = context?.time ?? resolvedTime.time ?? null;
    if (resolvedTime.time) rest = resolvedTime.rest;

    // 5. 标题
    const title = context?.title ?? cleanTitle(rest);

    // 6. 缺失信息检查（产品原则：信息缺失时询问，不自动猜测）
    const missing: string[] = [];
    if (!title) missing.push("title");
    if (!date) missing.push("date");
    if (!time) missing.push("time");

    // 连续 N 天时默认从今天开始（"连续四天" 隐含起始点）
    const startDate = date ?? (repeatDays > 0 ? todayStr() : null);

    let events: ParsedEvent[] = [];
    if (title && startDate && time) {
      for (let i = 0; i < (repeatDays > 0 ? repeatDays : 1); i++) {
        events.push({
          title,
          date: repeatDays > 0 ? addDaysStr(startDate, i) : startDate,
          time,
          endTime: resolvedTime.endTime,
          repeat: repeatDays > 0 ? null : repeat,
          note: undefined,
        });
      }
    }

    let message: string;
    if (missing.length > 0) {
      const names: Record<string, string> = { title: "做什么", date: "哪天", time: "几点" };
      message = `还差一点信息：${missing.map((k) => names[k]).join("、")}。请告诉我。`;
    } else if (repeatDays > 0) {
      message = `已为你安排从 ${startDate} 起连续 ${repeatDays} 天的日程。`;
    } else {
      message = "已为你安排好日程，确认后保存。";
    }

    return Promise.resolve({
      events: missing.length > 0 ? [{ title, date: startDate ?? "", time, repeat }] : events,
      missing,
      message,
    });
  },
};
