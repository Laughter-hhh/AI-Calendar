// 事件数据访问层：所有 SQL 都集中在这里
import { getDb } from "./db";

export interface CalendarEvent {
  id: number;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  repeat: string | null;
  sourceText: string | null;
}

export interface NewEvent {
  title: string;
  date: string;
  time: string | null;
  endTime?: string | null;
  note?: string | null;
  repeat?: string | null;
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
    sourceText: row.source_text === null ? null : String(row.source_text),
  };
}

export function listEvents(userId: number, date: string): CalendarEvent[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM events
       WHERE user_id = ? AND event_date = ?
       ORDER BY (start_time IS NULL) ASC, start_time ASC, id ASC`
    )
    .all(userId, date) as unknown as Record<string, unknown>[];
  return rows.map(mapRow);
}

export function createEvent(userId: number, data: NewEvent): CalendarEvent {
  const info = getDb()
    .prepare(
      `INSERT INTO events (user_id, title, event_date, start_time, end_time, note, repeat, source_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      data.title.trim(),
      data.date,
      data.time ?? null,
      data.endTime ?? null,
      data.note ?? null,
      data.repeat ?? null,
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
    sourceText: data.sourceText !== undefined ? data.sourceText : (existing.source_text as string | null),
  };

  db.prepare(
    `UPDATE events
     SET title = ?, event_date = ?, start_time = ?, end_time = ?, note = ?, repeat = ?, source_text = ?
     WHERE id = ? AND user_id = ?`
  ).run(
    merged.title,
    merged.date,
    merged.time,
    merged.endTime,
    merged.note,
    merged.repeat,
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
