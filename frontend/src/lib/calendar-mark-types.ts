import { isValidDateStr } from "./date";

export type CalendarMarkType = "holiday" | "anniversary" | "custom";

export interface CalendarMark {
  id: number;
  date: string;
  title: string;
  type: CalendarMarkType;
  note: string | null;
  updatedAt: string;
}

export interface NewCalendarMark {
  date: string;
  title: string;
  type?: CalendarMarkType;
  note?: string | null;
}

export interface BuiltinCalendarMark {
  id: string;
  date: string;
  title: string;
  type: Exclude<CalendarMarkType, "custom">;
}

const FIXED_MARKS: Array<{ monthDay: string; title: string; type: Exclude<CalendarMarkType, "custom"> }> = [
  { monthDay: "01-01", title: "元旦", type: "holiday" },
  { monthDay: "02-14", title: "情人节", type: "anniversary" },
  { monthDay: "03-08", title: "妇女节", type: "anniversary" },
  { monthDay: "03-12", title: "植树节", type: "anniversary" },
  { monthDay: "04-01", title: "愚人节", type: "anniversary" },
  { monthDay: "05-01", title: "劳动节", type: "holiday" },
  { monthDay: "05-04", title: "青年节", type: "anniversary" },
  { monthDay: "06-01", title: "儿童节", type: "anniversary" },
  { monthDay: "07-01", title: "建党节", type: "anniversary" },
  { monthDay: "08-01", title: "建军节", type: "anniversary" },
  { monthDay: "09-10", title: "教师节", type: "anniversary" },
  { monthDay: "10-01", title: "国庆节", type: "holiday" },
  { monthDay: "12-13", title: "国家公祭日", type: "anniversary" },
  { monthDay: "12-25", title: "圣诞节", type: "anniversary" },
];

export function builtinCalendarMarks(from: string, to: string): BuiltinCalendarMark[] {
  if (!isValidDateStr(from) || !isValidDateStr(to) || from > to) return [];
  const out: BuiltinCalendarMark[] = [];
  for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year += 1) {
    for (const mark of FIXED_MARKS) {
      const date = `${year}-${mark.monthDay}`;
      if (date < from || date > to) continue;
      out.push({ ...mark, id: `builtin:${date}:${mark.title}`, date });
    }
  }
  return out;
}
