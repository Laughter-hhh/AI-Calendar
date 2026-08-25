# AI Calendar 学习笔记

这份笔记把项目开发过程中涉及的核心知识梳理成一条线，配合代码阅读效果最好。建议按下面的顺序读。

## 1. 一句话理解这个应用

用户说一句话 → 前端把文字发给后端接口 → 后端交给 AI 解析层 → 得到结构化的"标题 + 日期 + 时间" → 存入数据库 → 前端刷新展示。

```
用户输入 ──▶ API 接口 ──▶ AI 解析层 ──▶ 事件数据 ──▶ SQLite
   ▲                                                        │
   └────────────── 前端展示 ◀───────────────────────────────┘
```

## 2. 前后端一体的 Next.js（App Router）

传统做法是前端一个项目、后端一个项目。这个项目按产品文档选择 **Next.js 一体式**：一个项目同时提供界面和接口。

- `frontend/src/app/page.tsx`：首页，属于**服务端组件**——在服务器上直接读数据库，渲染好后发给浏览器。这也解释了为什么首页打开就有"今天"的日程。
- `frontend/src/app/api/.../route.ts`：**API 路由**，每个文件对应一个接口。例如 `api/events/route.ts` 对应 `POST /api/events`（创建事件）和 `GET /api/events`（查事件）。
- `frontend/src/components/` 里以 `"use client"` 开头的文件是**客户端组件**，负责交互（按钮点击、输入框、语音）。规则：**能用服务端就别用客户端**，只有需要交互的部分才标记为客户端。

关键理解：页面和接口都跑在同一个 Next.js 服务里，但职责分开——页面只负责展示，接口负责读写数据。

## 3. 数据层为什么要独立

所有数据库操作集中在 `frontend/src/lib/`：

- `db.ts`：负责打开 SQLite 数据库、建表
- `events.ts`：事件的增删改查 SQL
- `auth.ts`：注册、登录、会话

好处：如果以后从 SQLite 换到 PostgreSQL（产品文档里的规划），只需要改 `db.ts` 这一层，页面和接口都不用动。这就是"数据访问层"的意义。

数据库本身在 `database/` 目录：

- `schema.sql`：表结构"蓝图"
- `data/ai-calendar.db`：实际的数据文件（已加入 .gitignore，不提交）

本项目用的是 Node.js 内置的 SQLite，不需要安装任何数据库软件。

## 4. 认证是怎么做的（MVP 简化版）

登录流程：

1. 用户注册：邮箱 + 密码
2. 密码**不能明文存**——用 scrypt 加盐哈希后存数据库（`auth.ts` 里的 `hashPassword`）
3. 登录成功：服务器生成一个随机 token，存进 sessions 表，同时通过 **httpOnly Cookie** 发给浏览器
4. 之后每次请求，服务器读 Cookie 里的 token，在 sessions 表里查到对应用户，就知道"你是谁"
5. Cookie 标记为 httpOnly 意味着浏览器里的 JavaScript 读不到它，降低被窃取的风险

这是"服务端会话"模型，简单直接。以后加 Google 登录时，只需要替换登录那一步，换成 OAuth 流程，后面依然用同样的会话机制。

## 5. AI 服务层：为什么"模型可替换"

代码里 `backend/ai/` 是独立的一层：

```
types.ts  定义统一结构（事件、解析结果）——所有模型都必须输出这个格式
service.ts 入口：有 Key 用 OpenAI 兼容服务，否则用本地解析器
providers/openai.ts  调用 /chat/completions 接口
providers/local.ts   纯正则规则解析（无需网络）
```

只要新模型输出同样的 JSON 结构，往 `providers/` 里加一个文件就能切换。这正是产品文档第 8 节"AI 模型可以替换"的实现方式。

没有 API Key 也能跑，是因为有本地解析器兜底——这是"先跑通"原则的体现。

## 6. 产品原则在代码里的体现

产品文档说：**信息缺失时 AI 询问用户，不自动猜测。**

对应代码：本地解析器解析完会检查 `title / date / time` 是否齐全，缺哪个就把哪个放进 `missing` 数组；接口返回后，前端弹出追问框，用户补充后带着上下文再解析一次。

这也带来一个重要的工程概念：**协议先行**。`types.ts` 里定义好"解析结果长什么样"，前后端、不同 AI 模型都按这个协议说话，大家互不依赖。

## 7. 开发中踩过的坑（记录）

- **跨目录引用**：前端要引用项目根目录下 `backend/ai` 的代码，构建工具默认不允许引用 Next.js 应用目录之外的文件。解决办法是在 `next.config.ts` 里设置 `turbopack.root` 指向项目根目录。
- **路径别名**：TypeScript 和 Turbopack 对 `tsconfig.json` 里 paths 别名的解析基准不同，容易踩坑。目前跨目录引用统一用相对路径，避免两套解析打架。
- **中文编码**：命令行工具发送中文请求体时要注意编码，测试脚本用 Node.js 编写（天然 UTF-8），避免 PowerShell 的编码问题。
- **Node 版本**：项目需要 Node 22.5+（使用内置 SQLite），如果本机没有装 Node，需要在 PATH 中配置好。
- **时区**：服务器默认是 UTC，而用户在中国。如果"今天"用服务器本地时间算，晚上 8 点到 12 点之间创建的日程会差一天。解决办法：统一按中国时区计算日期（`backend/ai/date-utils.ts` 和 `frontend/src/lib/date.ts`），并在 pm2 环境变量里设置 `TZ=Asia/Shanghai`。这也是一个典型的"本地正常、上线出错"的问题来源。
- **客户端组件状态不会跟着服务端刷新自动更新**：把服务端传来的数据当作 `useState` 的初始值后，即使父组件用 `router.refresh()` 拿到了新数据，子组件的 state 也不会变——表现就是"保存了日程但列表不显示"。解决办法：用 `useEffect` 监听传入的 props 变化并同步到 state（本项目 `EventList.tsx` 就是这么修的），或者给组件换 `key` 强制重新挂载。这是"添加了但看不到"这个反馈的根因。

## 8. 推荐阅读顺序

1. `database/schema.sql` — 先看数据长什么样
2. `backend/ai/types.ts` + `backend/ai/providers/local.ts` — 看 AI 怎么把一句话变成结构化数据
3. `frontend/src/app/api/events/route.ts` — 看接口怎么存取数据
4. `frontend/src/lib/auth.ts` — 看登录原理
5. `frontend/src/app/page.tsx` + `frontend/src/components/AiInput.tsx` — 看界面如何把这一切串起来

## 9. 下一步可以学什么

- **重复事件**：产品文档规划的每天/每周/每月规则（可用 RRULE 标准表达）
- **更多 AI 能力**：让 AI 理解"把刚才的学习改到晚上九点"（需要对话上下文）
- **部署**：Vercel / 云服务器，把项目发布到公网
- **数据库迁移**：把数据层从 SQLite 换到 PostgreSQL
