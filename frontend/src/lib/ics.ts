import { createHash } from "node:crypto";
import type { ImportedEvent } from "./events";
import { isValidDateStr } from "./date";

const APP_TIME_ZONE = "Asia/Shanghai";

interface IcsProperty {
  name: string;
  params: Map<string, string>;
  value: string;
}

interface ParsedDateTime {
  date: string;
  time: string | null;
  allDay: boolean;
}

export interface IcsParseResult {
  events: ImportedEvent[];
  total: number;
  failed: number;
  duplicatesInFile: number;
  skippedByLimit: number;
  warnings: string[];
}

function unfold(content: string): string[] {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && out.length > 0) out[out.length - 1] += line.slice(1);
    else out.push(line);
  }
  return out;
}

function parseProperty(line: string): IcsProperty | null {
  const colon = line.indexOf(":");
  if (colon < 1) return null;
  const head = line.slice(0, colon).split(";");
  const name = head.shift()?.toUpperCase();
  if (!name) return null;
  const params = new Map<string, string>();
  for (const raw of head) {
    const equals = raw.indexOf("=");
    if (equals < 1) continue;
    const key = raw.slice(0, equals).toUpperCase();
    const value = raw.slice(equals + 1).replace(/^"(.*)"$/, "$1");
    params.set(key, value);
  }
  return { name, params, value: line.slice(colon + 1) };
}

function propertiesOf(block: string): Map<string, IcsProperty[]> {
  const properties = new Map<string, IcsProperty[]>();
  for (const line of unfold(block)) {
    const property = parseProperty(line);
    if (!property) continue;
    const list = properties.get(property.name) ?? [];
    list.push(property);
    properties.set(property.name, list);
  }
  return properties;
}

function first(properties: Map<string, IcsProperty[]>, name: string): IcsProperty | undefined {
  return properties.get(name)?.[0];
}

function unescapeText(value: string): string {
  return value
    .replace(/\\[nN]/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function partsInTimeZone(date: Date, timeZone: string): Record<string, number> {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return parts;
}

function zonedDateTimeToUtc(
  values: { year: number; month: number; day: number; hour: number; minute: number; second: number },
  timeZone: string
): Date {
  const desired = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
  let guess = desired;
  for (let i = 0; i < 4; i += 1) {
    const actual = partsInTimeZone(new Date(guess), timeZone);
    const represented = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    const delta = desired - represented;
    guess += delta;
    if (delta === 0) break;
  }
  return new Date(guess);
}

function appDateTimeOf(instant: Date): ParsedDateTime {
  const parts = partsInTimeZone(instant, APP_TIME_ZONE);
  const date = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  const time = `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
  return { date, time, allDay: false };
}

function parseDateTime(property: IcsProperty): ParsedDateTime | null {
  const match = property.value
    .trim()
    .match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/i);
  if (!match) return null;
  const [, y, m, d, h, minute, second, utc] = match;
  const date = `${y}-${m}-${d}`;
  if (!isValidDateStr(date)) return null;
  const allDay = property.params.get("VALUE")?.toUpperCase() === "DATE" || !h;
  if (allDay) return { date, time: null, allDay: true };

  const values = {
    year: Number(y),
    month: Number(m),
    day: Number(d),
    hour: Number(h),
    minute: Number(minute),
    second: Number(second ?? "0"),
  };
  if (utc) {
    return appDateTimeOf(
      new Date(Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second))
    );
  }

  const timeZone = property.params.get("TZID");
  if (timeZone && timeZone !== APP_TIME_ZONE && timeZone !== "Asia/Chongqing") {
    try {
      return appDateTimeOf(zonedDateTimeToUtc(values, timeZone));
    } catch {
      // 未知 TZID 时保留文件中的墙上时间，避免整条日程丢失。
    }
  }
  return { date, time: `${h}:${minute}`, allDay: false };
}

function repeatOf(
  value: string | undefined,
  startDate: string,
  title: string,
  warnings: string[]
): { repeat: string | null; repeatUntil: string | null } {
  if (!value) return { repeat: null, repeatUntil: null };
  const fields = new Map(
    value.split(";").map((field) => {
      const [key, raw = ""] = field.split("=", 2);
      return [key.toUpperCase(), raw] as const;
    })
  );
  const frequency = fields.get("FREQ")?.toUpperCase();
  const repeat =
    frequency === "DAILY" ? "daily" : frequency === "WEEKLY" ? "weekly" : frequency === "MONTHLY" ? "monthly" : null;
  const until = fields.get("UNTIL")?.match(/^(\d{4})(\d{2})(\d{2})/);
  let canRepresent = repeat !== null && !fields.has("COUNT") && (!fields.has("INTERVAL") || fields.get("INTERVAL") === "1");
  const weekdayCodes = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  if (repeat === "weekly" && fields.has("BYDAY")) {
    const byDay = fields.get("BYDAY")?.split(",") ?? [];
    const startWeekday = weekdayCodes[new Date(`${startDate}T00:00:00Z`).getUTCDay()];
    canRepresent = canRepresent && byDay.length === 1 && byDay[0] === startWeekday;
  } else if (fields.has("BYDAY")) {
    canRepresent = false;
  }
  if (repeat === "monthly" && fields.has("BYMONTHDAY")) {
    canRepresent =
      canRepresent &&
      fields.get("BYMONTHDAY") === String(Number(startDate.slice(8, 10)));
  } else if (fields.has("BYMONTHDAY")) {
    canRepresent = false;
  }
  const supportedKeys = new Set(["FREQ", "UNTIL", "INTERVAL", "BYDAY", "BYMONTHDAY", "WKST"]);
  if ([...fields.keys()].some((key) => !supportedKeys.has(key))) canRepresent = false;
  if (!canRepresent) {
    warnings.push(`${title}：复杂重复规则无法完整表达，仅导入首个日期`);
  }
  return {
    repeat: canRepresent ? repeat : null,
    repeatUntil: canRepresent && until ? `${until[1]}-${until[2]}-${until[3]}` : null,
  };
}

function fallbackUid(event: Omit<ImportedEvent, "externalUid">): string {
  const canonical = JSON.stringify([
    event.title,
    event.date,
    event.time,
    event.endTime,
    event.note,
    event.repeat,
    event.repeatUntil,
  ]);
  return `hash:${createHash("sha256").update(canonical).digest("hex")}`;
}

function eventOf(block: string, warnings: string[]): ImportedEvent | null {
  const properties = propertiesOf(block);
  const title = first(properties, "SUMMARY")?.value.trim();
  const startProperty = first(properties, "DTSTART");
  if (!title || !startProperty) return null;
  if (first(properties, "STATUS")?.value.toUpperCase() === "CANCELLED") return null;

  const start = parseDateTime(startProperty);
  if (!start) return null;
  const endProperty = first(properties, "DTEND");
  const end = endProperty ? parseDateTime(endProperty) : null;
  let endTime: string | null = null;
  if (!start.allDay && end?.time && end.date === start.date && end.time > (start.time ?? "")) {
    endTime = end.time;
  } else if (!start.allDay && end && end.date !== start.date) {
    warnings.push(`${unescapeText(title)}：跨日结束时间暂不支持，已保留开始时间`);
  }

  const readableTitle = unescapeText(title);
  const { repeat, repeatUntil } = repeatOf(
    first(properties, "RRULE")?.value,
    start.date,
    readableTitle,
    warnings
  );
  if (properties.has("EXDATE") || properties.has("RDATE")) {
    warnings.push(`${readableTitle}：例外日期暂不支持，已按可表达的基础规则导入`);
  }
  const note = first(properties, "DESCRIPTION")?.value;
  const base = {
    title: readableTitle,
    date: start.date,
    time: start.time,
    endTime,
    note: note ? unescapeText(note).trim() || null : null,
    repeat,
    repeatUntil,
    done: first(properties, "STATUS")?.value.toUpperCase() === "COMPLETED",
    sourceText: "ICS 导入",
  } satisfies Omit<ImportedEvent, "externalUid">;
  const uid = first(properties, "UID")?.value.trim();
  const recurrenceId = first(properties, "RECURRENCE-ID")?.value.trim();
  return {
    ...base,
    externalUid: `ics:${uid ? `${uid}${recurrenceId ? `:${recurrenceId}` : ""}` : fallbackUid(base)}`,
  };
}

export function parseIcs(content: string, maxEvents = 1000): IcsParseResult {
  const blocks = content.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/gi) ?? [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  const events: ImportedEvent[] = [];
  let failed = 0;
  let duplicatesInFile = 0;

  for (const block of blocks.slice(0, maxEvents)) {
    const event = eventOf(block, warnings);
    if (!event) {
      failed += 1;
      continue;
    }
    if (seen.has(event.externalUid)) {
      duplicatesInFile += 1;
      continue;
    }
    seen.add(event.externalUid);
    events.push(event);
  }

  return {
    events,
    total: blocks.length,
    failed,
    duplicatesInFile,
    skippedByLimit: Math.max(0, blocks.length - maxEvents),
    warnings: [...new Set(warnings)].slice(0, 8),
  };
}
