import { getDb } from "./db";

export interface CalendarInfo {
  id: number;
  name: string;
  color: string;
}

function mapRow(row: Record<string, unknown>): CalendarInfo {
  return { id: Number(row.id), name: String(row.name), color: String(row.color ?? "blue") };
}

function cleanName(name: string): string {
  const value = name.trim();
  if (!value || value.length > 40) throw new Error("日历名称不能为空且最多 40 字");
  return value;
}

/** 为旧账号补建默认日历，并返回该账号的日历列表。 */
export function listCalendars(userId: number): CalendarInfo[] {
  const db = getDb();
  const exists = db.prepare("SELECT id FROM calendars WHERE user_id = ? ORDER BY id LIMIT 1").get(userId) as { id: number } | undefined;
  if (!exists) db.prepare("INSERT INTO calendars (user_id, name, color) VALUES (?, '我的日历', 'blue')").run(userId);
  const rows = db.prepare("SELECT id, name, color FROM calendars WHERE user_id = ? ORDER BY id").all(userId) as unknown as Record<string, unknown>[];
  return rows.map(mapRow);
}

export function getCalendar(userId: number, calendarId: number): CalendarInfo | null {
  const row = getDb().prepare("SELECT id, name, color FROM calendars WHERE id = ? AND user_id = ?").get(calendarId, userId) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

export function createCalendar(userId: number, name: string, color = "blue"): CalendarInfo {
  const safeName = cleanName(name);
  const result = getDb().prepare("INSERT INTO calendars (user_id, name, color, updated_at) VALUES (?, ?, ?, datetime('now'))").run(userId, safeName, color || "blue");
  return { id: Number(result.lastInsertRowid), name: safeName, color: color || "blue" };
}

export function updateCalendar(userId: number, calendarId: number, data: { name?: string; color?: string }): CalendarInfo | null {
  const current = getCalendar(userId, calendarId);
  if (!current) return null;
  const name = data.name === undefined ? current.name : cleanName(data.name);
  const color = data.color === undefined ? current.color : data.color || "blue";
  getDb().prepare("UPDATE calendars SET name = ?, color = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?").run(name, color, calendarId, userId);
  return { id: calendarId, name, color };
}

export function deleteCalendar(userId: number, calendarId: number): boolean {
  const db = getDb();
  const count = Number((db.prepare("SELECT COUNT(*) AS count FROM calendars WHERE user_id = ?").get(userId) as { count: number }).count);
  if (count <= 1) throw new Error("至少保留一个日历");
  const result = db.prepare("DELETE FROM calendars WHERE id = ? AND user_id = ?").run(calendarId, userId);
  return result.changes > 0;
}
