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
  repeat_until TEXT,           -- 重复截止日期 YYYY-MM-DD（可空）
  color       TEXT,            -- 分类颜色：red/orange/green/blue/purple（可空）
  done        INTEGER NOT NULL DEFAULT 0,  -- 是否已完成：0=否 1=是
  source_text TEXT,            -- 用户输入的原始自然语言，便于追溯和优化
  external_uid TEXT,           -- 外部导入事件的稳定标识；用于重复导入时跳过，不覆盖原日程
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  series_id   INTEGER REFERENCES events(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(user_id, event_date);

-- 重复事件的"例外日"：某一天不生成该重复事件（仅删除本日时使用）
CREATE TABLE IF NOT EXISTS event_exceptions (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  date     TEXT NOT NULL,
  PRIMARY KEY (event_id, date)
);

-- 日历共享：owner_user_id 把自己的日历共享给 viewer_user_id（只读）
CREATE TABLE IF NOT EXISTS calendar_shares (
  owner_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (owner_user_id, viewer_user_id)
);

-- 笔记本：记录"不确定什么时候做、但需要做的事"（不占用日历，时间确定后可转为日程）
CREATE TABLE IF NOT EXISTS notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,   -- 0=未完成 1=已完成
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id, done, created_at);
