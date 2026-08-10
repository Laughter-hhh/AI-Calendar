// 数据库初始化脚本：创建数据目录 + 建表
// 运行方式：在项目根目录执行 `pnpm setup` 或 `node database/init.mjs`
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "data");
mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "ai-calendar.db");
const db = new DatabaseSync(dbPath);
db.exec(readFileSync(path.join(here, "schema.sql"), "utf8"));
db.exec("PRAGMA journal_mode = WAL;");
db.close();

console.log("✅ 数据库已就绪：", dbPath);
