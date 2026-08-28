// 事件分类颜色（参照主流日历应用的彩色标签）
export const EVENT_COLORS: Array<{ value: string; label: string; dot: string }> = [
  { value: "", label: "无", dot: "bg-zinc-200" },
  { value: "red", label: "红", dot: "bg-red-500" },
  { value: "orange", label: "橙", dot: "bg-orange-500" },
  { value: "amber", label: "黄", dot: "bg-amber-500" },
  { value: "green", label: "绿", dot: "bg-green-500" },
  { value: "blue", label: "蓝", dot: "bg-sky-500" },
  { value: "purple", label: "紫", dot: "bg-violet-500" },
  { value: "pink", label: "粉", dot: "bg-pink-500" },
];

export function colorDot(value: string | null): string {
  return EVENT_COLORS.find((c) => c.value === value)?.dot ?? "bg-zinc-200";
}
