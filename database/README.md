# database/

存放 SQLite 数据库相关文件：

- `schema.sql`：表结构定义（用户、会话、事件），是数据库的"蓝图"
- `init.mjs`：一键初始化脚本，执行后会在 `database/data/` 下生成 `ai-calendar.db`
- `data/`：实际数据库文件（已在 `.gitignore` 中忽略，不提交到 Git）

说明：

- MVP 使用 Node.js 内置的 `node:sqlite`，无需单独安装数据库软件
- 应用启动时也会自动确保表结构存在，因此即使不手动执行 `init.mjs` 也能运行
- 未来迁移 PostgreSQL 时，只需替换 `frontend/src/lib/db.ts` 这一层的数据访问实现
