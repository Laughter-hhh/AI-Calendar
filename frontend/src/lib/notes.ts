// 笔记本数据访问层：记录"不确定什么时候做、但需要做的事"
// 笔记本条目不属于日程（无日期无时间），时间确定后可一键转为日程
import { getDb } from "./db";

export interface Note {
  id: number;
  text: string;
  done: boolean;
  createdAt: string;
}

function mapRow(row: Record<string, unknown>): Note {
  return {
    id: Number(row.id),
    text: String(row.text),
    done: Number(row.done) === 1,
    createdAt: String(row.created_at),
  };
}

/** 查询某用户的全部笔记本条目：未完成在前，新的在前 */
export function listNotes(userId: number): Note[] {
  const rows = getDb()
    .prepare("SELECT * FROM notes WHERE user_id = ? ORDER BY done ASC, id DESC")
    .all(userId) as unknown as Record<string, unknown>[];
  return rows.map(mapRow);
}

/** 新增一条笔记本条目 */
export function createNote(userId: number, text: string): Note {
  const info = getDb()
    .prepare("INSERT INTO notes (user_id, text) VALUES (?, ?)")
    .run(userId, text.trim());
  return {
    id: Number(info.lastInsertRowid),
    text: text.trim(),
    done: false,
    createdAt: "",
  };
}

/** 修改笔记本条目（文字 / 完成状态），返回修改后的条目；不存在返回 null */
export function updateNote(
  userId: number,
  noteId: number,
  changes: { text?: string; done?: boolean }
): Note | null {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM notes WHERE id = ? AND user_id = ?")
    .get(noteId, userId) as Record<string, unknown> | undefined;
  if (!existing) return null;

  const text = changes.text !== undefined && changes.text.trim() ? changes.text.trim() : String(existing.text);
  const done = changes.done !== undefined ? (changes.done ? 1 : 0) : Number(existing.done);
  db.prepare("UPDATE notes SET text = ?, done = ? WHERE id = ? AND user_id = ?").run(
    text,
    done,
    noteId,
    userId
  );
  const updated = db
    .prepare("SELECT * FROM notes WHERE id = ? AND user_id = ?")
    .get(noteId, userId) as Record<string, unknown>;
  return mapRow(updated);
}

/** 删除笔记本条目，返回是否真的删除了 */
export function deleteNote(userId: number, noteId: number): boolean {
  const info = getDb().prepare("DELETE FROM notes WHERE id = ? AND user_id = ?").run(noteId, userId);
  return info.changes > 0;
}
