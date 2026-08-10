// 统一日期计算：全部按中国时区（UTC+8，无夏令时）
// 背景：服务器可能是 UTC 时区，直接 new Date() 会在晚上 8 点后把"今天"算成前一天
const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 今天的日期字符串（中国时区），格式 YYYY-MM-DD */
export function todayStr(): string {
  return new Date(Date.now() + CHINA_OFFSET_MS).toISOString().slice(0, 10);
}

/** 在日期字符串上加减天数，返回 YYYY-MM-DD */
export function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d) + CHINA_OFFSET_MS);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/** 日期字符串对应星期几，0=周日，1=周一 … */
export function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}
