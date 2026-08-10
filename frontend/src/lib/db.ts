// 数据库连接（Node.js 内置 SQLite，无需额外安装）
// 所有数据访问都经过这个模块，未来迁移 PostgreSQL 时只需替换这里
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

let db: DatabaseSync | null = null;

/** 定位数据库文件：dev/build 时工作目录是 frontend/，向上取一层到项目根 */
function resolveBaseDir(): string {
  const cwd = process.cwd();
  return cwd.endsWith("frontend") ? path.join(cwd, "..") : cwd;
}

const EMBEDDED_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  event_date  TEXT NOT NULL,
  start_time  TEXT,
  end_time    TEXT,
  note        TEXT,
  repeat      TEXT,
  source_text TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(user_id, event_date);
`;

export function getDb(): DatabaseSync {
  if (db) return db;

  const base = resolveBaseDir();
  const dataDir = path.join(base, "database", "data");
  fs.mkdirSync(dataDir, { recursive: true });

  db = new DatabaseSync(path.join(dataDir, "ai-calendar.db"));

  // 优先读取 database/schema.sql（单一事实来源），读不到时用内置兜底
  let schema: string;
  try {
    schema = fs.readFileSync(path.join(base, "database", "schema.sql"), "utf8");
  } catch {
    schema = EMBEDDED_SCHEMA;
  }
  db.exec(schema);
  db.exec("PRAGMA journal_mode = WAL;");
  return db;
}
