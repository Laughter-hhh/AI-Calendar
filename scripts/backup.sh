#!/usr/bin/env bash
# AI Calendar 数据库备份脚本
# 用法：sudo bash scripts/backup.sh [应用目录]   （默认 /opt/ai-calendar）
# 备份到 <应用目录>/backups/，保留最近 14 份
set -euo pipefail

APP_DIR="${1:-/opt/ai-calendar}"
DB="$APP_DIR/database/data/ai-calendar.db"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
STAMP=$(date +%Y%m%d-%H%M%S)

if [ ! -f "$DB" ]; then
  echo "未找到数据库：$DB"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
DEST="$BACKUP_DIR/ai-calendar-$STAMP.db"

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" ".backup '$DEST'"
else
  cp "$DB" "$DEST"
  # WAL 模式：把未合并的日志一并复制，尽量保持一致
  [ -f "$DB-wal" ] && cp "$DB-wal" "$DEST-wal"
  [ -f "$DB-shm" ] && cp "$DB-shm" "$DEST-shm"
fi

# 清理 14 天前的备份
find "$BACKUP_DIR" -name "ai-calendar-*.db*" -mtime +14 -delete 2>/dev/null || true

echo "✅ 备份完成：$DEST"
echo "   备份目录：$BACKUP_DIR（保留最近 14 份）"
