// 事件分类颜色（参照主流日历应用的彩色标签）
export const EVENT_COLORS: Array<{ value: string; label: string; dot: string }> = [
  { value: "", label: "无", dot: "bg-zinc-200" },
  { value: "red", label: "红", dot: "bg-red-400" },
  { value: "orange", label: "橙", dot: "bg-orange-400" },
  { value: "green", label: "绿", dot: "bg-emerald-400" },
  { value: "blue", label: "蓝", dot: "bg-blue-400" },
  { value: "purple", label: "紫", dot: "bg-violet-400" },
];

export function colorDot(value: string | null): string {
  return EVENT_COLORS.find((c) => c.value === value)?.dot ?? "bg-zinc-200";
}
