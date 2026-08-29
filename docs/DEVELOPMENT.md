# AI Calendar 开发总览（新成员 / 新 AI 必读）

> 本文档是项目的**交接手册**。任何新的开发者或 AI 智能体接手前，请先完整阅读本文档，再按需阅读 `docs/versions/` 下的版本说明和 `docs/ROADMAP.md`（待拓展与待确认项）。

最后更新：2026-08-26（v3.3.0）

---

## 1. 项目是什么

AI Calendar 是一个 **AI 原生的个人时间管理助手**：用户用自然语言告诉 AI 要做什么，AI 解析后自动生成日程。产品规划见 [AI-Calendar-Product-Specification.md](AI-Calendar-Product-Specification.md)。

核心原则（来自产品文档）：

- 信息缺失时 AI **询问用户**，不自动猜测
- AI 模型**可替换**，用户数据独立保存
- 先完成、再优化；跑通核心闭环 > 体验 > 智能 > 商业

## 2. 当前状态（2026-08-25）

- **线上地址**：http://39.106.121.28:3000（阿里云 ECS，2 核 2G，Ubuntu 22.04）
- **部署方式**：GitHub Actions 云端构建 + standalone 产物自动部署（`git push` 即上线）
- **已完成**：注册/登录、AI 自然语言创建日程（连续 N 天）、信息追问、语音输入、单日/未来7天/月三种视图、搜索、事件详情与备注、增强编辑（日期/结束时间/备注/颜色）、完整重复事件（每天/每周/每月 + 截止日期 + 仅删本日）、AI 自然语言修改/删除日程、ICS 导入导出、事件颜色分类、今日下一项提示、手机 App（WebView 壳 + 独立 APK 网页直下）、CI 自动部署、数据库备份脚本、冒烟测试（51 项）与页面渲染测试（16 项）
- **当前版本标签**：`v3.3.0`

## 3. 技术栈与架构

| 层 | 技术 |
|---|---|
| 前端 | Next.js 16（App Router + Turbopack）+ React 19 + TypeScript + Tailwind CSS 4 |
| 后端 | Next.js Server API（Route Handlers，位于 `frontend/src/app/api/`） |
| 数据库 | Node.js 内置 SQLite（`node:sqlite`），单文件，无需额外安装 |
| 认证 | 邮箱 + 密码（scrypt 加盐哈希）+ 服务端会话（随机 token 存 Cookie） |
| AI 服务层 | `backend/ai/`：模型理解并标准化（可选）+ 本地规则解析器执行（默认/兜底） |
| 手机 App | `mobile/`：Expo (React Native) + react-native-webview 壳 |
| 部署 | `.github/workflows/deploy.yml`：CI 构建 standalone 产物 → scp 上传 → pm2 重启 |

### 架构示意

```
浏览器 / 手机 App
      │ HTTP
      ▼
Next.js（页面 + API 路由）
      ├── /api/auth/*    认证
      ├── /api/events/*  日程 CRUD
      ├── /api/ai/parse  自然语言 → 结构化日程
      └── /api/health    健康检查
      │
      ▼
backend/ai（AI 服务层，模型可替换）
      ▼
frontend/src/lib（db / auth / events 数据层）
      ▼
SQLite 单文件（database/data/ai-calendar.db）
```

## 4. 目录结构

```
AI-Calendar/
├── docs/
│   ├── DEVELOPMENT.md                    # 本文档（交接手册）
│   ├── ROADMAP.md                         # 待拓展功能 + 待确认项
│   ├── API.md                             # 接口文档（v3 新增）
│   ├── versions/                          # 各版本详细说明
│   ├── AI-Calendar-Product-Specification.md
│   └── LEARNING.md                        # 面向用户的学习笔记
├── frontend/                              # 主应用（Next.js）
│   ├── src/app/                           # 页面 + API 路由
│   │   ├── api/{auth,events,ai,health}/   # 后端接口
│   │   ├── layout.tsx / page.tsx          # 布局与首页
│   ├── src/components/                    # 客户端组件（AuthCard/AiInput/EventList/DateNav...）
│   ├── src/lib/                           # 数据层（db/auth/events/date）
│   └── next.config.ts                     # standalone 输出 + turbopack root
├── backend/ai/                            # AI 服务层（独立于前后端）
│   ├── types.ts                           # 统一数据结构（模型可替换的关键）
│   ├── service.ts                         # 入口：有 Key 用 AI，否则本地解析器
│   ├── date-utils.ts                      # 中国时区日期工具
│   └── providers/{local,openai}.ts
├── database/                              # 表结构 schema.sql + 初始化脚本
├── deploy/                                # 部署脚本与各平台指南
├── mobile/                                # 手机 App（Expo + WebView 壳）
├── scripts/                               # 冒烟测试 / 页面渲染检查 / 备份
├── ecosystem.config.cjs                   # pm2 配置（CI 部署用）
└── .github/workflows/deploy.yml           # CI 构建 + 自动部署
```

## 5. 数据模型（SQLite）

见 [database/schema.sql](../database/schema.sql)。三个表：

**users**：`id, email(唯一), password_hash(scrypt 盐:哈希), created_at`

**sessions**：`token(主键), user_id, expires_at` —— 登录后发放随机 token，存在 httpOnly Cookie 中

**events**：

| 字段 | 说明 |
|---|---|
| `id` | 主键 |
| `user_id` | 归属用户（所有查询按 user_id 隔离） |
| `title` | 标题 |
| `event_date` | 日期 YYYY-MM-DD（中国时区） |
| `start_time` | HH:mm，NULL = 全天 |
| `end_time` | HH:mm，可选 |
| `note` | 备注 |
| `repeat` | 重复规则：`daily` / `weekly` / `monthly` / NULL |
| `repeat_until` | 重复截止日期（v2 新增，可空） |
| `source_text` | 用户原始自然语言（便于追溯） |
| `created_at` | 创建时间 |

> **迁移约定**：`CREATE TABLE IF NOT EXISTS` 不会给已存在的旧表加列。新增列必须在 `frontend/src/lib/db.ts` 里用 `PRAGMA table_info` 检测后 `ALTER TABLE ADD COLUMN`（v2 已为 `repeat_until` 实现该逻辑，后续照此模式扩展）。

## 6. 核心运行逻辑

### 6.1 创建日程闭环

1. 用户输入自然语言 → `POST /api/ai/parse`
2. AI 服务层返回 `ParseResult`：`{ events[], missing[], message }`
   - `missing` 非空 → 前端弹出追问框，用户补充后带上下文重试（不猜测原则）
3. 前端展示解析结果预览 → 用户点「确认添加」
4. `POST /api/events` 逐条保存 → `router.refresh()` → 列表更新

### 6.2 日期视图

- 首页读取 `?date=YYYY-MM-DD`，默认今天；日期统一按**中国时区**（UTC+8）计算
- `EventList` 用 `useEffect` 同步服务端传入的 `initialEvents`（防止保存后列表不刷新）

### 6.3 认证

- 注册/登录 → 服务端建 session → Cookie `ai_calendar_session`
- 每个 API 通过 `getSessionUser(cookie)` 校验，未登录返回 401

## 7. 接口一览（详见 docs/API.md）

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| POST | /api/auth/register | 注册 | 公开 |
| POST | /api/auth/login | 登录 | 公开 |
| POST | /api/auth/logout | 退出 | 登录 |
| GET | /api/auth/me | 当前用户 | 登录 |
| GET | /api/events?date=YYYY-MM-DD | 查某天日程（含重复展开） | 登录 |
| GET | /api/events?from=&to= | 区间查询（周/月视图） | 登录 |
| GET | /api/events/export?from=&to= | 导出 .ics（可导入 Google/Apple/Outlook） | 登录 |
| POST | /api/events/import | 导入 .ics（JSON `{ content }`） | 登录 |
| GET | /api/shares | 共享列表（我共享的 / 共享给我的） | 登录 |
| POST | /api/shares | 共享日历给某邮箱 | 登录 |
| DELETE | /api/shares?email= | 撤销共享 / 取消查看 | 登录 |
| POST | /api/events | 创建日程 | 登录 |
| PATCH | /api/events/:id | 修改 | 登录（本人） |
| DELETE | /api/events/:id | 删除 | 登录（本人） |
| POST | /api/ai/parse | 自然语言 → 模型标准化 → 本地规则生成日程 | 登录 |
| POST | /api/ai/action | 自然语言修改/删除日程 | 登录 |
| POST | /api/ai/stt | 语音转文字（录音上传，需配置 Key） | 登录 |
| GET | /api/version | 当前版本号（自动更新检测） | 公开 |
| GET | /api/health | 健康检查 | 公开 |

## 8. AI 解析规则（本地解析器行为）

`backend/ai/providers/local.ts` 支持：

- 相对日期：今天/明天/后天、周X/下周一、N月N日
- 时间：15:30、下午3点、晚上八点、三点半、时间段（3点到5点）
- 重复：连续N天（展开为 N 个事件）、每天/每周/每月（存 repeat 规则）
- 缺失追问：缺标题/日期/时间 → missing 数组
- 清理口语前缀：我要/我想/帮我/请/从…开始

配置 `OPENAI_API_KEY` 后走 OpenAI 兼容接口（`backend/ai/providers/openai.ts`），失败自动回退本地解析器。

## 9. 测试

```bash
# 先启动服务（本地 dev 或 standalone 均可）
pnpm dev                 # 在 frontend/ 下

# API 冒烟测试（40 项）
pnpm test:smoke          # 或 BASE_URL=... node scripts/smoke-test.mjs

# 页面渲染检查（按日期查看）
pnpm test:ui             # 或 BASE_URL=... node scripts/ui-render-check.mjs
```

**任何代码改动后必须**：`tsc --noEmit` → `pnpm build` → 冒烟测试通过（→ 页面渲染检查）。

## 10. 部署

- **CI 自动部署**：推送 `main` → GitHub Actions 构建 standalone → 上传 `/opt/ai-calendar/app` → pm2 `startOrReload`
- **服务器目录**：代码在 `/opt/ai-calendar/app`（每次部署替换），数据库在 `/opt/ai-calendar/database/data/ai-calendar.db`（**不随部署清空**）
- **数据库路径**：pm2 环境变量 `DATABASE_PATH` 指定；本地默认 `database/data/`
- **手动部署**（备用）：见 [deploy/DEPLOYMENT.md](../deploy/DEPLOYMENT.md)
- **手机 App**：见 [mobile/README.md](../mobile/README.md)

## 11. 版本历史

| 版本 | 日期 | 内容 | Git 标签 |
|---|---|---|---|
| v1.0.0 | 2026-08-25 | MVP 闭环、CI 部署、日期查看、手机 App 壳 | `v1.0.0` |
  | v2.0.0 | 2026-08-25 | 完整重复事件：每天/每周/每月按规则展开、截止日期、仅删本日 | `v2.0.0` |
  | v2.1.0 | 2026-08-25 | AI 修改/删除日程："把学习改到晚上九点" / "删除明天的会议" | `v2.1.0` |
  | v3.0.0 | 2026-08-25 | 未来 7 天视图、区间查询、备份脚本、API 文档、健康检查含数据库探测 | `v3.0.0` |
  | v3.1.0 | 2026-08-25 | 月视图、事件详情与备注、增强编辑、搜索、ICS 导出、今日下一项提示 | `v3.1.0` |
  | v3.2.0 | 2026-08-26 | ICS 导入、事件颜色分类 | `v3.2.0` |
  | v3.3.0 | 2026-08-26 | 安卓独立 APK 网页直下分发、下载页/接口、商店上架成本与更新策略文档 | `v3.3.0` |
| v3.3.1 | 2026-08-26 | 修复月视图跨月跳转失效（组件状态与 URL 单一数据源） | `v3.3.1` |
| v3.4.0 | 2026-08-26 | iOS 构建配置与分发流程就绪（ATS、TestFlight 文档） | `v3.4.0` |
  | v3.5.0 | 2026-08-26 | 勾选完成事项（含 AI"完成XX"、月视图 ✓、ICS STATUS） | `v3.5.0` |
  | v3.6.0 | 2026-08-26 | 共享日历（只读）：共享/撤销、共享视图、权限控制 | `v3.6.0` |
  | v3.7.0 | 2026-08-26 | 语音识别（手机录音上传）、自动更新提示、区间查询性能优化、定时/待办分组 | `v3.7.0` |
  | v3.7.1 | 2026-08-26 | AI 服务独立配置文件（服务器可直配 Key，手机语音即生效） | `v3.7.1` |
  | v3.8.0 | 2026-08-26 | 手机端性能重构（前端即时切换）+ 移动界面紧凑化 | `v3.8.0` |
  | v3.9.0 | 2026-08-26 | 网页/手机双排版（响应式断点，桌面宽松版 + 移动紧凑版） | `v3.9.0` |
  | v3.10.0 | 2026-08-28 | 离线缓存（本地读取）、解析修复（点半/标题）、混合识别模式 | `v3.10.0` |
  | v3.10.1 | 2026-08-28 | AI 输出校正层（模型结果规范化 + 兜底追问，杜绝脏数据） | `v3.10.1` |
  | v3.10.2 | 2026-08-28 | AI 提示词注入今天日期 + 兼容代码块输出 | `v3.10.2` |
  | v4.0.0 | 2026-08-28 | 双界面（时间安排时间轴 + 单日事项）、无时间待办、界面优化、测试流 | `v4.0.0` |
  | v4.0.1 | 2026-08-28 | 账号移入设置页，首页顶部仅保留设置入口 | `v4.0.1` |
  | v4.1.0 | 2026-08-28 | 主界面极简（⋯ 更多菜单收纳附加功能）、明亮配色 | `v4.1.0` |
  | v4.2.0 | 2026-08-29 | 无日期无时间自动识别待办、删除快捷按钮、项目 skill、布局教程 | `v4.2.0` |
  | v4.2.1 | 2026-08-29 | 柔和背景、时间文字跟随事件颜色 | `v4.2.1` |
  | v4.3.0 | 2026-08-29 | 截止日期自动提醒（7/3/1天+当天），skill 同步规则 | `v4.3.0` |
  | v4.3.1 | 2026-08-29 | 设置帮助页、导入导出按钮文字 | `v4.3.1` |
  | v4.3.2 | 2026-08-29 | 新建日程自动随机非灰色颜色 | `v4.3.2` |
  | v4.3.3 | 2026-08-29 | 日期/截止支持中文数字（八月三十一之前） | `v4.3.3` |
  | v4.3.4 | 2026-08-29 | 截止语句强制本地规则（配置 AI 也生效）+ 常用语句测试套件 | `v4.3.4` |
  | v4.3.5 | 2026-08-29 | 解析架构升级：模型理解 → 标准句式 → 本地规则执行 | `v4.3.5` |

## 12. 待拓展与待确认（摘要）

完整清单见 [docs/ROADMAP.md](ROADMAP.md)。当前最需要用户拍板的三件事：

1. **域名 + ICP 备案**：决定网站能否用域名/HTTPS（影响 App 正式打包与对外发布）
2. **真实 AI Key**：是否配置 OPENAI_API_KEY 提升解析能力
3. **重复事件的系列编辑语义**：改一个 vs 改整个系列

## 13. 开发约定（新 AI 必守）

- 改代码后必须跑：`tsc --noEmit` → `pnpm build` → `pnpm test:smoke`（→ `pnpm test:ui`）
- 日期计算一律走 `backend/ai/date-utils.ts` 或 `frontend/src/lib/date.ts`（中国时区），禁止裸 `new Date()` 做日期字符串
- 跨目录引用（frontend ↔ backend）用**相对路径**，不用 tsconfig 别名（Turbopack 与 tsc 解析基准不一致，踩过坑）
- 数据库结构变更：同时更新 `database/schema.sql` 和 `frontend/src/lib/db.ts` 的迁移逻辑，兼容旧库
- 每个功能里程碑：更新本文档、写 `docs/versions/vX.Y.Z.md`、打 Git 标签、推送 GitHub
- **版本号约定**：发布新版本时同步更新 `frontend/src/lib/version.ts` 的 `APP_VERSION` 与 Git 标签号，保持一致（自动更新检测依赖它）
- **AI 服务配置**：统一走 `backend/ai/config.ts`（环境变量优先，`/opt/ai-calendar/config.env` 兜底，见 README），不要在代码里硬编码密钥
- **AI 选型与语音**：选型/验证/安全/常见坑见 [docs/AI-CONFIG-HANDBOOK.md](AI-CONFIG-HANDBOOK.md)；模型建议 V3 级（deepseek-chat），7B 小模型对结构化输出遵从度低
- 中文界面与中文注释保持一致；面向用户的说明用中文
