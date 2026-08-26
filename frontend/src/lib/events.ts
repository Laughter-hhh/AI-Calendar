// 事件数据访问层：所有 SQL 和重复规则展开都集中在这里
import { getDb } from "./db";
import { shiftDate } from "./date";

export interface CalendarEvent {
  id: number;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  repeat: string | null;
  repeatUntil: string | null;
  color: string | null;
  done: boolean;
  sourceText: string | null;
}

export interface NewEvent {
  title: string;
  date: string;
  time: string | null;
  endTime?: string | null;
  note?: string | null;
  repeat?: string | null;
  repeatUntil?: string | null;
  color?: string | null;
  done?: boolean;
  sourceText?: string | null;
}

function mapRow(row: Record<string, unknown>): CalendarEvent {
  return {
    id: Number(row.id),
    title: String(row.title),
    date: String(row.event_date),
    startTime: row.start_time === null ? null : String(row.start_time),
    endTime: row.end_time === null ? null : String(row.end_time),
    note: row.note === null ? null : String(row.note),
    repeat: row.repeat === null ? null : String(row.repeat),
    repeatUntil: row.repeat_until === null ? null : String(row.repeat_until),
    color: row.color === null ? null : String(row.color),
    done: Number(row.done) === 1,
    sourceText: row.source_text === null ? null : String(row.source_text),
  };
}

/** 该日期字符串的星期几（0=周日）与当月天数，统一用 UTC 解析（日期字符串即日历日） */
function dayInfo(dateStr: string): { weekday: number; dayOfMonth: number; daysInMonth: number } {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return { weekday: d.getUTCDay(), dayOfMonth: d.getUTCDate(), daysInMonth };
}

/** 重复规则是否覆盖目标日期 */
export function occursOn(baseDate: string, repeat: string, target: string): boolean {
  if (target < baseDate) return false;
  const base = dayInfo(baseDate);
  const targetInfo = dayInfo(target);
  if (repeat === "daily") return true;
  if (repeat === "weekly") return base.weekday === targetInfo.weekday;
  if (repeat === "monthly") {
    // 正常：同一天号；月末兜底：base 是月末时，目标日也是其所在月的月末
    if (base.dayOfMonth === targetInfo.dayOfMonth) return true;
    return base.dayOfMonth === base.daysInMonth && targetInfo.dayOfMonth === targetInfo.daysInMonth;
  }
  return false;
}

/** 查询某天的日程（含重复事件展开与例外日排除） */
export function listEvents(userId: number, date: string): CalendarEvent[] {
  const db = getDb();

  // 该日的例外事件 id（用户在这天取消了某个重复事件）
  const exceptions = new Set<number>(
    (db.prepare("SELECT event_id FROM event_exceptions WHERE date = ?").all(date) as Array<{ event_id: number }>).map(
      (r) => Number(r.event_id)
    )
  );

  const direct = db
    .prepare("SELECT * FROM events WHERE user_id = ? AND event_date = ?")
    .all(userId, date) as unknown as Record<string, unknown>[];
  const recurring = db
    .prepare(
      `SELECT * FROM events
       WHERE user_id = ? AND event_date <= ? AND repeat IS NOT NULL`
    )
    .all(userId, date) as unknown as Record<string, unknown>[];

  const byId = new Map<number, CalendarEvent>();

  for (const row of direct) {
    const ev = mapRow(row);
    if (!exceptions.has(ev.id)) byId.set(ev.id, ev);
  }

  for (const row of recurring) {
    const ev = mapRow(row);
    if (byId.has(ev.id)) continue; // 直接事件已覆盖
    if (exceptions.has(ev.id)) continue; // 本日被排除
    if (ev.repeatUntil && date > ev.repeatUntil) continue;
    if (occursOn(ev.date, ev.repeat!, date)) {
      byId.set(ev.id, { ...ev, date });
    }
  }

  return [...byId.values()].sort((a, b) => {
    if (a.startTime === null && b.startTime === null) return a.id - b.id;
    if (a.startTime === null) return -1;
    if (b.startTime === null) return 1;
    return a.startTime.localeCompare(b.startTime) || a.id - b.id;
  });
}

/** 查询日期区间的日程（每天展开重复事件），用于周视图 / AI 修改日程的候选搜索 */
export function listEventsRange(userId: number, from: string, to: string): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  let d = from;
  let guard = 0;
  while (d <= to && guard < 366) {
    out.push(...listEvents(userId, d));
    d = shiftDate(d, 1);
    guard += 1;
  }
  return out;
}

export function createEvent(userId: number, data: NewEvent): CalendarEvent {
  const info = getDb()
    .prepare(
      `INSERT INTO events (user_id, title, event_date, start_time, end_time, note, repeat, repeat_until, color, done, source_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      data.title.trim(),
      data.date,
      data.time ?? null,
      data.endTime ?? null,
      data.note ?? null,
      data.repeat ?? null,
      data.repeatUntil ?? null,
      data.color ?? null,
      data.done ? 1 : 0,
      data.sourceText ?? null
    );
  return {
    id: Number(info.lastInsertRowid),
    title: data.title.trim(),
    date: data.date,
    startTime: data.time ?? null,
    endTime: data.endTime ?? null,
    note: data.note ?? null,
    repeat: data.repeat ?? null,
    repeatUntil: data.repeatUntil ?? null,
    color: data.color ?? null,
    done: data.done === true,
    sourceText: data.sourceText ?? null,
  };
}

export function updateEvent(
  userId: number,
  eventId: number,
  data: Partial<NewEvent>
): CalendarEvent | null {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM events WHERE id = ? AND user_id = ?")
    .get(eventId, userId) as Record<string, unknown> | undefined;
  if (!existing) return null;

  const merged: Required<NewEvent> = {
    title: data.title?.trim() || String(existing.title),
    date: data.date || String(existing.event_date),
    time: data.time !== undefined ? data.time : (existing.start_time as string | null),
    endTime: data.endTime !== undefined ? data.endTime : (existing.end_time as string | null),
    note: data.note !== undefined ? data.note : (existing.note as string | null),
    repeat: data.repeat !== undefined ? data.repeat : (existing.repeat as string | null),
    repeatUntil: data.repeatUntil !== undefined ? data.repeatUntil : (existing.repeat_until as string | null),
    color: data.color !== undefined ? data.color : (existing.color as string | null),
    done: data.done !== undefined ? data.done === true : Number(existing.done) === 1,
    sourceText: data.sourceText !== undefined ? data.sourceText : (existing.source_text as string | null),
  };

  db.prepare(
    `UPDATE events
     SET title = ?, event_date = ?, start_time = ?, end_time = ?, note = ?, repeat = ?, repeat_until = ?, color = ?, done = ?, source_text = ?
     WHERE id = ? AND user_id = ?`
  ).run(
    merged.title,
    merged.date,
    merged.time,
    merged.endTime,
    merged.note,
    merged.repeat,
    merged.repeatUntil,
    merged.color,
    merged.done ? 1 : 0,
    merged.sourceText,
    eventId,
    userId
  );

  const updated = db
    .prepare("SELECT * FROM events WHERE id = ? AND user_id = ?")
    .get(eventId, userId) as Record<string, unknown>;
  return mapRow(updated);
}

export function deleteEvent(userId: number, eventId: number): boolean {
  const info = getDb().prepare("DELETE FROM events WHERE id = ? AND user_id = ?").run(eventId, userId);
  return info.changes > 0;
}

/** 仅删除重复事件的某一天：往例外表记一条，不删基础事件 */
export function deleteSingleOccurrence(
  userId: number,
  eventId: number,
  date: string
): { ok: boolean; mode: "exception" | "deleted" | "not_found" } {
  const db = getDb();
  const ev = db
    .prepare("SELECT * FROM events WHERE id = ? AND user_id = ?")
    .get(eventId, userId) as Record<string, unknown> | undefined;
  if (!ev) return { ok: false, mode: "not_found" };

  // 只有"重复事件的基础日期之后"才记例外；基础日当天或非重复事件直接删
  if (ev.repeat && String(ev.event_date) !== date && date > String(ev.event_date)) {
    db.prepare("INSERT OR IGNORE INTO event_exceptions (event_id, date) VALUES (?, ?)").run(eventId, date);
    return { ok: true, mode: "exception" };
  }
  db.prepare("DELETE FROM events WHERE id = ? AND user_id = ?").run(eventId, userId);
  return { ok: true, mode: "deleted" };
}
