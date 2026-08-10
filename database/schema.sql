-- AI Calendar 数据库结构（SQLite）
-- MVP 阶段：单文件数据库，未来可平滑迁移到 PostgreSQL

-- 用户表：简单邮箱账号体系
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 会话表：登录后发放随机 token，保存在浏览器 Cookie 中
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- 事件表：MVP 事件模型 = 标题 + 日期 + 时间
CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  event_date  TEXT NOT NULL,   -- YYYY-MM-DD
  start_time  TEXT,            -- HH:mm，NULL 表示全天事件
  end_time    TEXT,            -- HH:mm，可选
  note        TEXT,
  repeat      TEXT,            -- 未来扩展：daily / weekly / monthly ...
  source_text TEXT,            -- 用户输入的原始自然语言，便于追溯和优化
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(user_id, event_date);
