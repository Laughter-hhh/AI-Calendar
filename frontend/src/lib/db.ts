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

/** 数据库文件位置：优先用环境变量 DATABASE_PATH（服务器独立部署时指定），否则用项目内默认路径 */
function resolveDbPath(baseDir: string): string {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;
  return path.join(baseDir, "database", "data", "ai-calendar.db");
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
  repeat_until TEXT,
  color       TEXT,
  done        INTEGER NOT NULL DEFAULT 0,
  source_text TEXT,
  external_uid TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(user_id, event_date);
CREATE TABLE IF NOT EXISTS event_exceptions (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  date     TEXT NOT NULL,
  PRIMARY KEY (event_id, date)
);
CREATE TABLE IF NOT EXISTS calendar_shares (
  owner_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (owner_user_id, viewer_user_id)
);
CREATE TABLE IF NOT EXISTS notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id, done, created_at);
`;

/** 兼容旧数据库：给已存在的 events 表补上新增的列 */
function ensureEventsColumns(db: DatabaseSync): void {
  const cols = db.prepare("PRAGMA table_info(events)").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "repeat_until")) {
    db.exec("ALTER TABLE events ADD COLUMN repeat_until TEXT");
  }
  if (!cols.some((c) => c.name === "color")) {
    db.exec("ALTER TABLE events ADD COLUMN color TEXT");
  }
  if (!cols.some((c) => c.name === "done")) {
    db.exec("ALTER TABLE events ADD COLUMN done INTEGER NOT NULL DEFAULT 0");
  }
  if (!cols.some((c) => c.name === "external_uid")) {
    db.exec("ALTER TABLE events ADD COLUMN external_uid TEXT");
  }
}

export function getDb(): DatabaseSync {
  if (db) return db;

  const base = resolveBaseDir();
  const dbPath = resolveDbPath(base);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new DatabaseSync(dbPath);

  // 优先读取 database/schema.sql（单一事实来源），读不到时用内置兜底
  let schema: string;
  try {
    schema = fs.readFileSync(path.join(base, "database", "schema.sql"), "utf8");
  } catch {
    schema = EMBEDDED_SCHEMA;
  }
  db.exec(schema);
  ensureEventsColumns(db);
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_events_user_external_uid ON events(user_id, external_uid)");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}
