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
export function resolveDate(text: string): { date: string; rest: string } | null {
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

  const monthDay = rest.match(/([零一二两三四五六七八九十\d]{1,3})月([零一二两三四五六七八九十\d]{1,3})[日号]?/);
  if (monthDay) {
    const month = cnToNumber(monthDay[1]);
    const day = cnToNumber(monthDay[2]);
    if (month !== null && day !== null && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = Number(todayStr().slice(0, 4));
      rest = rest.replace(monthDay[0], " ");
      const dateStr = `${year}-${pad2(month)}-${pad2(day)}`;
      return { date: addDaysStr(dateStr, 0), rest: rest.replace(/\s+/g, " ").trim() };
    }
  }

  return null;
}

/** 解析“本周三和周四”这类当前周的多个一次性日期。 */
export function resolveCurrentWeekdayList(text: string): { dates: string[]; rest: string } | null {
  const phrase = text.match(
    /(?:本|这)(?:周|星期|礼拜)\s*(?:(?:周|星期|礼拜)\s*)?[日天一二三四五六](?:(?:\s*(?:和|、|及|以及|,|，)\s*)(?:(?:本|这)?(?:周|星期|礼拜))?\s*[日天一二三四五六])+/
  );
  if (!phrase) return null;

  const weekdays = phrase[0].match(/[日天一二三四五六]/g) ?? [];
  if (weekdays.length < 2) return null;

  const today = todayStr();
  const todayWeekday = weekdayOf(today);
  const monday = addDaysStr(today, -(todayWeekday === 0 ? 6 : todayWeekday - 1));
  const dates = [...new Set(weekdays.map((day) => {
    const target = WEEKDAY_NAME[day];
    return addDaysStr(monday, target === 0 ? 6 : target - 1);
  }))];

  return {
    dates,
    rest: text.replace(phrase[0], " ").replace(/\s+/g, " ").trim(),
  };
}

/** 解析时间表达，返回 { time, endTime, 去掉时间词后的剩余文本 } */
export function resolveTime(text: string): { time: string | null; endTime: string | null; rest: string } {
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
      // "点半" 优先（否则"八点半"会被"八点"先匹配，丢掉"半"）
      const half = rest.match(/([零一二两三四五六七八九十\d]{1,3})点半/);
      const cn = half ? null : rest.match(/([零一二两三四五六七八九十\d]{1,3})[点时]([零一二三四五六七八九十\d]{1,2})?分?/);
      const m = half ?? cn;
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
export function cleanTitle(raw: string): string {
  return raw
    .replace(/^\s*(我要|我想|帮我|请|安排一下|安排|预约|定个|记下|添加|加上|从|开始|进行|去|来做|去做|准备|组织|参加|完成)/, "")
    .replace(/[。！？!?，,；;]/g, " ")
    .replace(/^[:：,，、;；\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 是否截止类语句（"X月Y日前/之前完成XX"），这类语句必须走确定性本地规则生成提醒 */
export function isDeadlineSentence(text: string): boolean {
  return /(?:截止|截至)?(?:到|在)?[零一二两三四五六七八九十\d]{1,3}月[零一二两三四五六七八九十\d]{1,3}[日号]?(?:前|之前|截止|前截止)/.test(
    text
  );
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

    // 2. 重复规则（每天/每周X/每月X日 + 截止日期）
    let repeat: string | null = null;
    let repeatUntil: string | null = null;
    let repeatStart: string | null = null; // 具体规则的起始日（如"每周一"的下一个周一）

    const untilMatch = rest.match(/持续(?:到)?(\d{1,2})月(\d{1,2})[日号]?/);
    if (untilMatch) {
      const year = Number(todayStr().slice(0, 4));
      repeatUntil = `${year}-${pad2(Number(untilMatch[1]))}-${pad2(Number(untilMatch[2]))}`;
      rest = rest.replace(untilMatch[0], " ");
    }

    if (/每天|每日|每晚/.test(rest)) {
      repeat = "daily";
      rest = rest.replace(/每天|每日|每晚/g, " ");
    } else {
      const weeklySpec = rest.match(/每(?:周|星期|礼拜)([日天一二三四五六])/);
      const monthlySpec = rest.match(/每月(\d{1,2})[日号]/);
      if (weeklySpec) {
        repeat = "weekly";
        repeatStart = nextWeekdayDate(WEEKDAY_NAME[weeklySpec[1]]);
        rest = rest.replace(weeklySpec[0], " ");
      } else if (monthlySpec) {
        repeat = "monthly";
        repeatStart = nextMonthDayDate(Number(monthlySpec[1]));
        rest = rest.replace(monthlySpec[0], " ");
      } else if (/每周/.test(rest)) {
        repeat = "weekly";
        rest = rest.replace(/每周/g, " ");
      } else if (/每月/.test(rest)) {
        repeat = "monthly";
        rest = rest.replace(/每月/g, " ");
      }
    }

    // “本周/这周”表示当前周的有限日期集合，不是每周重复。
    const currentWeekdays = resolveCurrentWeekdayList(rest);
    if (currentWeekdays) rest = currentWeekdays.rest;

    // 2.5 截止日期提醒任务："8月31号前完成实验报告" → 截止前 7/3/1 天 + 当天各一条待办
    let deadlineDate: string | null = null;
    const deadlineMatch = rest.match(
      /(?:截止|截至)?(?:到|在)?([零一二两三四五六七八九十\d]{1,3})月([零一二两三四五六七八九十\d]{1,3})[日号]?(?:前|之前|截止|前截止)/
    );
    if (deadlineMatch) {
      const y = Number(todayStr().slice(0, 4));
      const m = cnToNumber(deadlineMatch[1]);
      const d = cnToNumber(deadlineMatch[2]);
      if (m !== null && d !== null && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        // "X月Y日前" → 有效截止日为 Y-1（例：8月31号前 → 8.30 截止）
        deadlineDate = addDaysStr(`${y}-${pad2(m)}-${pad2(d)}`, -1);
        rest = rest.replace(deadlineMatch[0], " ");
      }
    }

    // 3. 日期（重复规则可自带起始日，如"每周一"）
    const resolvedDate = currentWeekdays ? null : resolveDate(rest);
    const date = context?.date ?? resolvedDate?.date ?? currentWeekdays?.dates[0] ?? repeatStart ?? null;
    if (resolvedDate) rest = resolvedDate.rest;

    // 4. 时间
    const resolvedTime = resolveTime(rest);
    let time = context?.time ?? resolvedTime.time ?? null;
    if (resolvedTime.time) rest = resolvedTime.rest;

    // 截止任务不设具体时间（全天待办）
    if (deadlineDate) time = null;

    // 无时间待办：明确说"无时间/待办/不限定时间"时，不再追问时间，生成全天待办
    const wantsNoTime = /无时间|没有时间|不限定时间|不定时间|(^|[:：，, ])待办(事项)?/.test(rest);
    if (wantsNoTime) {
      rest = rest
        .replace(/无时间|没有时间|不限定时间|不定时间/g, " ")
        .replace(/(^|[:：，, ])待办(事项)?/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      time = null;
    }

    // 默认起始日期：
    // - 连续 N 天 / 重复规则 → 今天（隐含起始点）
    // - 既没有日期也没有时间 → 识别为待办事项，默认今天，不再追问
    const startDate = deadlineDate ?? date ?? (repeatDays > 0 || repeat || !time ? todayStr() : null);

    // 5. 标题
    const title = context?.title ?? cleanTitle(rest);

    // 6. 缺失信息检查（产品规则：缺标题/日期才追问；时间缺失一律按全天待办处理）
    const missing: string[] = [];
    if (!title) missing.push("title");
    if (!startDate) missing.push("date");

    let events: ParsedEvent[] = [];
    if (deadlineDate && title) {
      const reminders: Array<[string, number]> = [
        [`距离${title}还有七天`, 7],
        [`距离${title}还有三天`, 3],
        [`距离${title}还有一天`, 1],
        [`今天截止：${title}`, 0],
      ];
      for (const [rt, offset] of reminders) {
        events.push({
          title: rt,
          date: addDaysStr(deadlineDate, -offset),
          time: null,
          endTime: null,
          repeat: null,
          repeatUntil: null,
          note: `截止：${deadlineDate}`,
        });
      }
    } else if (title && startDate) {
      const eventDates = currentWeekdays?.dates ?? null;
      for (let i = 0; i < (eventDates?.length ?? (repeatDays > 0 ? repeatDays : 1)); i++) {
        events.push({
          title,
          date: eventDates?.[i] ?? (repeatDays > 0 ? addDaysStr(startDate, i) : startDate),
          time,
          endTime: resolvedTime.endTime,
          repeat: repeatDays > 0 || eventDates ? null : repeat,
          repeatUntil: repeatDays > 0 || eventDates ? null : repeatUntil,
          note: undefined,
        });
      }
    }

    let message: string;
    if (missing.length > 0) {
      const names: Record<string, string> = { title: "做什么", date: "哪天" };
      // 先回显已识别到的信息，避免用户误以为系统没听懂（例：晚上八点学习 → 已识别时间，缺日期）
      const recognized: string[] = [];
      if (title) recognized.push(`「${title}」`);
      if (startDate) recognized.push(startDate);
      if (time) recognized.push(time);
      const echo = recognized.length > 0 ? `已识别：${recognized.join(" ")}。` : "";
      message = `${echo}还差一点信息：${missing.map((k) => names[k]).join("、")}。请告诉我。`;
    } else if (currentWeekdays) {
      message = `已为你安排本周 ${currentWeekdays.dates.length} 天的日程。`;
    } else if (repeatDays > 0) {
      message = `已为你安排从 ${startDate} 起连续 ${repeatDays} 天的日程。`;
    } else if (repeat) {
      const repeatNames: Record<string, string> = { daily: "每天", weekly: "每周", monthly: "每月" };
      message = `已为你安排${repeatNames[repeat] ?? repeat}重复的日程${repeatUntil ? `，至 ${repeatUntil} 结束` : ""}。`;
    } else if (deadlineDate) {
      message = `已为「${title}」生成截止提醒：提前 7 天、3 天、1 天、当天（截止 ${deadlineDate}）。`;
    } else if (!time) {
      // 有日期无时间（或默认今天）→ 全天待办
      message = `已识别为全天待办：${startDate}「${title}」。确认后保存。`;
    } else {
      message = "已为你安排好日程，确认后保存。";
    }

    return Promise.resolve({
      events: missing.length > 0 ? [{ title, date: startDate ?? "", time, repeat, repeatUntil }] : events,
      missing,
      message,
    });
  },
};

/** 下一个指定星期几（今天匹配则从今天开始） */
function nextWeekdayDate(target: number): string {
  const diff = (target - weekdayOf(todayStr()) + 7) % 7;
  return addDaysStr(todayStr(), diff);
}

/** 下一个指定日期号（今天匹配则从今天开始；月末兜底） */
function nextMonthDayDate(day: number): string {
  const t = todayStr();
  for (let i = 0; i < 40; i++) {
    const d = addDaysStr(t, i);
    const dayOfMonth = Number(d.slice(8, 10));
    const daysInMonth = Number(new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0)).getUTCDate());
    if (dayOfMonth === day || (day > 28 && dayOfMonth === daysInMonth)) return d;
  }
  return t;
}
