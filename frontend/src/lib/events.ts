// 事件数据访问层：所有 SQL 和重复规则展开都集中在这里
import { getDb } from "./db";
import { shiftDate } from "./date";
import { EVENT_COLORS } from "./colors";
import { assertValidEventTiming } from "./event-validation";

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
  /** 最近一次修改时间，为未来跨设备同步提供增量游标 */
  updatedAt: string;
  /** 共享来源：他人共享的事件带对方邮箱，本人事件为 null */
  ownerEmail?: string | null;
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
  externalUid?: string | null;
  seriesId?: number | null;
}

export interface ImportedEvent extends NewEvent {
  externalUid: string;
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
    updatedAt: row.updated_at === null || row.updated_at === undefined ? "" : String(row.updated_at),
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

/** 单个用户在某天的日程（含重复事件展开与例外日排除） */
function eventsForOwnerOnDate(db: ReturnType<typeof getDb>, ownerId: number, date: string): CalendarEvent[] {
  // 该日的例外事件 id（用户在这天取消了某个重复事件）
  const exceptions = new Set<number>(
    (db.prepare("SELECT event_id FROM event_exceptions WHERE date = ?").all(date) as Array<{ event_id: number }>).map(
      (r) => Number(r.event_id)
    )
  );

  const direct = db
    .prepare("SELECT * FROM events WHERE user_id = ? AND event_date = ?")
    .all(ownerId, date) as unknown as Record<string, unknown>[];
  const recurring = db
    .prepare(
      `SELECT * FROM events
       WHERE user_id = ? AND event_date <= ? AND repeat IS NOT NULL`
    )
    .all(ownerId, date) as unknown as Record<string, unknown>[];

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

/** 查询某天的日程（本人 + 共享给我的日历），含重复事件展开与例外日排除 */
export function listEvents(userId: number, date: string): CalendarEvent[] {
  const db = getDb();
  const owners = getSharedOwners(db, userId);
  const out: CalendarEvent[] = [];
  for (const owner of owners) {
    for (const ev of eventsForOwnerOnDate(db, owner.id, date)) {
      out.push({ ...ev, ownerEmail: owner.email });
    }
  }
  return out.sort((a, b) => {
    if (a.startTime === null && b.startTime === null) return a.id - b.id;
    if (a.startTime === null) return -1;
    if (b.startTime === null) return 1;
    return a.startTime.localeCompare(b.startTime) || a.id - b.id;
  });
}

/** 需要展示的日历所有者列表：本人 + 共享给我的用户 */
function getSharedOwners(db: ReturnType<typeof getDb>, userId: number): Array<{ id: number; email: string | null }> {
  const rows = db
    .prepare(
      `SELECT u.id, u.email FROM calendar_shares s
       JOIN users u ON u.id = s.owner_user_id
       WHERE s.viewer_user_id = ?`
    )
    .all(userId) as unknown as Array<{ id: number | bigint; email: string }>;
  return [
    { id: userId, email: null },
    ...rows.map((r) => ({ id: Number(r.id), email: String(r.email) })),
  ];
}

/** 查询日期区间的日程（每天展开重复事件），用于周视图 / AI 修改日程的候选搜索 */
export function listEventsRange(userId: number, from: string, to: string): CalendarEvent[] {
  // 优化：不再按天循环查库，改为批量查询后内存展开（大幅减少查询次数，修复手机端卡顿）
  const db = getDb();
  const owners = getSharedOwners(db, userId);
  const out: CalendarEvent[] = [];

  for (const owner of owners) {
    const direct = db
      .prepare(
        `SELECT * FROM events
         WHERE user_id = ? AND event_date BETWEEN ? AND ? AND repeat IS NULL`
      )
      .all(owner.id, from, to) as unknown as Record<string, unknown>[];
    const recurring = db
      .prepare(
        `SELECT * FROM events
         WHERE user_id = ? AND repeat IS NOT NULL AND event_date <= ?
           AND (repeat_until IS NULL OR repeat_until >= ?)`
      )
      .all(owner.id, to, from) as unknown as Record<string, unknown>[];

    const exceptions = new Set<string>(
      (
        db
          .prepare("SELECT event_id, date FROM event_exceptions WHERE date BETWEEN ? AND ?")
          .all(from, to) as unknown as Array<{ event_id: number; date: string }>
      ).map((r) => `${Number(r.event_id)}:${r.date}`)
    );

    const seenIds = new Set<number>();
    for (const row of direct) {
      const ev = mapRow(row);
      if (exceptions.has(`${ev.id}:${ev.date}`)) continue;
      seenIds.add(ev.id);
      out.push({ ...ev, ownerEmail: owner.email });
    }
    for (const row of recurring) {
      const ev = mapRow(row);
      if (seenIds.has(ev.id)) continue;
      let d = from;
      let guard = 0;
      while (d <= to && guard < 400) {
        if (ev.repeatUntil && d > ev.repeatUntil) break;
        if (d >= ev.date && !exceptions.has(`${ev.id}:${d}`) && occursOn(ev.date, ev.repeat!, d)) {
          out.push({ ...ev, date: d, ownerEmail: owner.email });
        }
        d = shiftDate(d, 1);
        guard += 1;
      }
    }
  }

  return out.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.startTime === null && b.startTime === null) return a.id - b.id;
    if (a.startTime === null) return 1;
    if (b.startTime === null) return -1;
    return a.startTime.localeCompare(b.startTime) || a.id - b.id;
  });
}

/** 查找同一日期内的时间重叠事件。仅提示，不阻止创建或修改。 */
export function findEventConflicts(
  userId: number,
  date: string,
  startTime: string | null,
  endTime: string | null,
  excludeId?: number
): CalendarEvent[] {
  if (!startTime) return [];
  const start = clockMinutes(startTime);
  if (start === null) return [];
  const end = Math.min(24 * 60, Math.max(start + 30, clockMinutes(endTime) ?? start + 60));
  return listEvents(userId, date).filter((candidate) => {
    if (candidate.id === excludeId || !candidate.startTime) return false;
    const candidateStart = clockMinutes(candidate.startTime);
    if (candidateStart === null) return false;
    const candidateEnd = Math.min(
      24 * 60,
      Math.max(candidateStart + 30, clockMinutes(candidate.endTime) ?? candidateStart + 60)
    );
    return start < candidateEnd && candidateStart < end;
  });
}

function clockMinutes(value: string | null): number | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function createEvent(userId: number, data: NewEvent): CalendarEvent {
  assertValidEventTiming(data.time, data.endTime ?? null);
  // 未指定颜色时，自动随机分配一个非灰色（跳过 EVENT_COLORS 第一项"无"）
  const color = data.color ?? EVENT_COLORS[Math.floor(Math.random() * (EVENT_COLORS.length - 1)) + 1].value;
  const info = getDb()
    .prepare(
      `INSERT INTO events (user_id, title, event_date, start_time, end_time, note, repeat, repeat_until, color, done, source_text, external_uid, updated_at, series_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`
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
      color,
      data.done ? 1 : 0,
      data.sourceText ?? null,
      data.externalUid ?? null,
      data.seriesId ?? null
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
    color,
    done: data.done === true,
    sourceText: data.sourceText ?? null,
    updatedAt: new Date().toISOString(),
  };
}

/** 查询已导入的外部 UID，供导入预览使用；只看当前用户，不触碰原日程。 */
export function existingExternalUids(userId: number, uids: string[]): Set<string> {
  const unique = [...new Set(uids.filter(Boolean))];
  if (unique.length === 0) return new Set();
  const placeholders = unique.map(() => "?").join(", ");
  const rows = getDb()
    .prepare(`SELECT external_uid FROM events WHERE user_id = ? AND external_uid IN (${placeholders})`)
    .all(userId, ...unique) as unknown as Array<{ external_uid: string }>;
  return new Set(rows.map((row) => String(row.external_uid)));
}

/**
 * 原子批量导入：只插入尚未出现的 externalUid。
 * 不执行 UPDATE/DELETE，因此不会改变用户已有日程；整个批次失败时全部回滚。
 */
export function importEvents(userId: number, events: ImportedEvent[]): { imported: number; duplicates: number } {
  for (const event of events) assertValidEventTiming(event.time, event.endTime ?? null);
  const db = getDb();
  const known = existingExternalUids(userId, events.map((event) => event.externalUid));
  const insert = db.prepare(
    `INSERT OR IGNORE INTO events
      (user_id, title, event_date, start_time, end_time, note, repeat, repeat_until, color, done, source_text, external_uid, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  );
  let imported = 0;
  let duplicates = 0;

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const event of events) {
      if (known.has(event.externalUid)) {
        duplicates += 1;
        continue;
      }
      const color = event.color ?? EVENT_COLORS[Math.floor(Math.random() * (EVENT_COLORS.length - 1)) + 1].value;
      const result = insert.run(
        userId,
        event.title.trim(),
        event.date,
        event.time ?? null,
        event.endTime ?? null,
        event.note ?? null,
        event.repeat ?? null,
        event.repeatUntil ?? null,
        color,
        event.done ? 1 : 0,
        event.sourceText ?? null,
        event.externalUid
      );
      if (result.changes > 0) {
        imported += 1;
        known.add(event.externalUid);
      } else {
        duplicates += 1;
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return { imported, duplicates };
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
    externalUid: existing.external_uid as string | null,
    seriesId: existing.series_id === null || existing.series_id === undefined ? null : Number(existing.series_id),
  };
  assertValidEventTiming(merged.time, merged.endTime);

  db.prepare(
    `UPDATE events
     SET title = ?, event_date = ?, start_time = ?, end_time = ?, note = ?, repeat = ?, repeat_until = ?, color = ?, done = ?, source_text = ?, updated_at = datetime('now')
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

/**
 * 仅修改重复系列中的某一次：复制为一个独立事件，并把原重复事件的该日期记为例外。
 * 这样不会影响系列的其它日期，也无需把例外内容混入基础事件记录。
 */
export function updateSingleOccurrence(
  userId: number,
  eventId: number,
  occurrenceDate: string,
  data: Partial<NewEvent>
): CalendarEvent | null {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM events WHERE id = ? AND user_id = ?")
    .get(eventId, userId) as Record<string, unknown> | undefined;
  if (!existing) return null;

  const repeat = existing.repeat === null ? null : String(existing.repeat);
  if (!repeat) return updateEvent(userId, eventId, data);

  const event: NewEvent = {
    title: data.title?.trim() || String(existing.title),
    date: data.date || occurrenceDate,
    time: data.time !== undefined ? data.time : (existing.start_time as string | null),
    endTime: data.endTime !== undefined ? data.endTime : (existing.end_time as string | null),
    note: data.note !== undefined ? data.note : (existing.note as string | null),
    repeat: null,
    repeatUntil: null,
    color: data.color !== undefined ? data.color : (existing.color as string | null),
    done: data.done !== undefined ? data.done : Number(existing.done) === 1,
    sourceText: data.sourceText !== undefined ? data.sourceText : (existing.source_text as string | null),
    externalUid: null,
    seriesId: eventId,
  };
  assertValidEventTiming(event.time, event.endTime ?? null);

  db.exec("BEGIN IMMEDIATE");
  try {
    const copy = createEvent(userId, event);
    db.prepare("INSERT OR IGNORE INTO event_exceptions (event_id, date) VALUES (?, ?)").run(eventId, occurrenceDate);
    db.exec("COMMIT");
    return copy;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function deleteEvent(userId: number, eventId: number): boolean {
  const info = getDb()
    .prepare("DELETE FROM events WHERE user_id = ? AND (id = ? OR series_id = ?)")
    .run(userId, eventId, eventId);
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
