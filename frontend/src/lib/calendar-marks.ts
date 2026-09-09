import { getDb } from "./db";
import { isValidDateStr } from "./date";
import type { CalendarMark, CalendarMarkType, NewCalendarMark } from "./calendar-mark-types";
export type { CalendarMark, CalendarMarkType, NewCalendarMark } from "./calendar-mark-types";

function mapRow(row: Record<string, unknown>): CalendarMark {
  const rawType = String(row.type ?? "custom");
  const type: CalendarMarkType = rawType === "holiday" || rawType === "anniversary" ? rawType : "custom";
  return {
    id: Number(row.id),
    date: String(row.mark_date),
    title: String(row.title),
    type,
    note: row.note === null || row.note === undefined ? null : String(row.note),
    updatedAt: row.updated_at === null || row.updated_at === undefined ? "" : String(row.updated_at),
  };
}

function validateMark(data: NewCalendarMark): { date: string; title: string; type: CalendarMarkType; note: string | null } {
  const date = typeof data.date === "string" ? data.date : "";
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const type = data.type === "holiday" || data.type === "anniversary" || data.type === "custom" ? data.type : "custom";
  const note = data.note == null ? null : String(data.note).trim() || null;
  if (!isValidDateStr(date)) throw new Error("日期格式不正确");
  if (!title || title.length > 80) throw new Error("标题不能为空且最多 80 字");
  if (note && note.length > 300) throw new Error("备注最多 300 字");
  return { date, title, type, note };
}

export function listCalendarMarks(userId: number, from: string, to: string): CalendarMark[] {
  if (!isValidDateStr(from) || !isValidDateStr(to) || from > to) return [];
  const rows = getDb()
    .prepare("SELECT * FROM calendar_marks WHERE user_id = ? AND mark_date BETWEEN ? AND ? ORDER BY mark_date, title, id")
    .all(userId, from, to) as unknown as Record<string, unknown>[];
  return rows.map(mapRow);
}

export function createCalendarMark(userId: number, data: NewCalendarMark): CalendarMark {
  const mark = validateMark(data);
  const result = getDb()
    .prepare("INSERT INTO calendar_marks (user_id, mark_date, title, type, note, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))")
    .run(userId, mark.date, mark.title, mark.type, mark.note);
  return {
    id: Number(result.lastInsertRowid),
    date: mark.date,
    title: mark.title,
    type: mark.type,
    note: mark.note,
    updatedAt: new Date().toISOString(),
  };
}

export function updateCalendarMark(userId: number, id: number, data: Partial<NewCalendarMark>): CalendarMark | null {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM calendar_marks WHERE id = ? AND user_id = ?").get(id, userId) as Record<string, unknown> | undefined;
  if (!existing) return null;
  const merged = validateMark({
    date: data.date ?? String(existing.mark_date),
    title: data.title ?? String(existing.title),
    type: data.type ?? (String(existing.type) as CalendarMarkType),
    note: data.note !== undefined ? data.note : (existing.note === null ? null : String(existing.note)),
  });
  db.prepare("UPDATE calendar_marks SET mark_date = ?, title = ?, type = ?, note = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?")
    .run(merged.date, merged.title, merged.type, merged.note, id, userId);
  const row = db.prepare("SELECT * FROM calendar_marks WHERE id = ? AND user_id = ?").get(id, userId) as Record<string, unknown>;
  return mapRow(row);
}

export function deleteCalendarMark(userId: number, id: number): boolean {
  const result = getDb().prepare("DELETE FROM calendar_marks WHERE id = ? AND user_id = ?").run(id, userId);
  return result.changes > 0;
}
