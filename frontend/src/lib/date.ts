// 前端/接口共用的日期工具：统一按中国时区计算"今天"

const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 今天的日期字符串（中国时区），格式 YYYY-MM-DD */
export function todayStr(): string {
  return new Date(Date.now() + CHINA_OFFSET_MS).toISOString().slice(0, 10);
}

/** 首页标题用：如 "8月10日 星期一" */
export function todayLabel(): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "Asia/Shanghai",
  }).format(new Date());
}
