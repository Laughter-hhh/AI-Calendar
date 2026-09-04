// 事件分类颜色：使用低饱和度圆点，避免彩色事项在移动端显得刺眼。
export const EVENT_COLORS: Array<{ value: string; label: string; dot: string }> = [
  { value: "", label: "无", dot: "bg-zinc-200" },
  { value: "red", label: "红", dot: "bg-red-400" },
  { value: "orange", label: "橙", dot: "bg-orange-400" },
  { value: "amber", label: "黄", dot: "bg-amber-400" },
  { value: "green", label: "绿", dot: "bg-green-400" },
  { value: "blue", label: "蓝", dot: "bg-sky-400" },
  { value: "purple", label: "紫", dot: "bg-violet-400" },
  { value: "pink", label: "粉", dot: "bg-pink-400" },
];

export function colorDot(value: string | null): string {
  return EVENT_COLORS.find((c) => c.value === value)?.dot ?? "bg-zinc-200";
}

/** 时间文字的彩色（跟随事件颜色） */
const TEXT_COLORS: Record<string, string> = {
  red: "text-red-600",
  orange: "text-orange-600",
  amber: "text-amber-600",
  green: "text-green-600",
  blue: "text-sky-600",
  purple: "text-violet-600",
  pink: "text-pink-600",
};

export function colorText(value: string | null): string {
  return (value && TEXT_COLORS[value]) || "text-zinc-700";
}
