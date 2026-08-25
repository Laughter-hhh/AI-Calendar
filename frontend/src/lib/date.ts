// 前端/接口共用的日期工具：统一按中国时区计算"今天"

const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 今天的日期字符串（中国时区），格式 YYYY-MM-DD */
export function todayStr(): string {
  return new Date(Date.now() + CHINA_OFFSET_MS).toISOString().slice(0, 10);
}

/** 校验日期字符串格式 YYYY-MM-DD */
export function isValidDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  return !Number.isNaN(new Date(Date.UTC(y, m - 1, d)).getTime());
}

/** 日期字符串加减天数，返回 YYYY-MM-DD */
export function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d) + CHINA_OFFSET_MS);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/** 展示用日期标题：今天/明天/昨天，或 "8月10日 星期一" */
export function dateLabel(dateStr: string): string {
  const today = todayStr();
  if (dateStr === today) return "今天";
  if (dateStr === shiftDate(today, 1)) return "明天";
  if (dateStr === shiftDate(today, -1)) return "昨天";
  const d = new Date(`${dateStr}T00:00:00Z`);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 周${weekdays[d.getUTCDay()]}`;
}
