---
name: ai-calendar-dev
description: 维护 AI Calendar 项目（E:\project\AI-Calendar）时遵循的产品规则与工程约定。适用于改代码、加功能、修 bug、改页面布局等本项目任务；非本项目任务不要使用。
---

# AI Calendar 开发规则

维护 `E:\project\AI-Calendar`（AI 原生的个人时间管理助手，Next.js 16 + Node 内置 SQLite）时遵循以下规则。

## 必读文档（按任务选择）

- 总体架构 / 运行逻辑 / API / 部署：`E:\project\AI-Calendar\docs\DEVELOPMENT.md`
- 改页面布局：`E:\project\AI-Calendar\docs\UI-LAYOUT-GUIDE.md`
- 配置 AI / 语音：`E:\project\AI-Calendar\docs\AI-CONFIG-HANDBOOK.md`
- 待办 / 待确认项：`E:\project\AI-Calendar\docs\ROADMAP.md`

## 产品规则（用户明确要求，必须遵守）

1. **无日期且无时间的输入 → 自动识别为当天待办**，不再追问。例："交报告" → 今天全天待办。
2. **有日期无时间 → 默认生成全天待办，不再追问**（2026-08-29 用户拍板）。例："九月一号领取美团骑行卡" → 9月1日全天待办；"明天开会" → 明天全天待办。
3. 有时间无日期 → 追问日期；缺标题 → 追问标题。
4. 信息缺失默认追问、不猜测（上两条待办规则除外）。
4. "八点半" = 08:30（点半优先匹配）；标题要去掉"进行 / 去 / 来做"等口语前缀。
5. 界面文案用中文；日期一律按中国时区计算。
6. 主界面保持极简：日程优先，附加功能（搜索 / 导出 / 导入 / 设置等）放进 ⋯ 菜单，不要占用主区域。
7. **截止日期任务**："8月31号前 / 八月三十一之前完成实验报告" → 自动生成 4 条待办提醒：截止前 7 天（"距离X还有七天"）、3 天、1 天、当天（"今天截止：X"）。"X月Y日前" 的有效截止日按 Y-1 处理（8月31号前 → 8.30 截止）；**日期同时支持阿拉伯数字和中文数字**（八月三十一 = 8月31）；标题要去掉"完成/交/做"等动作词只留事项本身。
8. **解析架构（重要）**：配置 AI 时，流程是"大模型理解语义 → 改写成标准句式 → 本地固定程序（local.ts）执行生成日程"。**所有确定性逻辑（截止提醒展开、连续 N 天、重复、待办识别、缺失追问、标题清洗）都由本地规则完成**，模型只做理解与标准化；不要用模型直接展开提醒，也不要绕过模型理解。
9. **笔记本（不确定时间的事）**：不确定什么时候做、但需要做的事记入"笔记本"（`/notes`），条目**不是日程**——无日期无时间、不参与日历查询/导出/今日下一项。支持记录、勾选完成、编辑、删除、清除已完成；时间确定后点"⏰ 转为日程"：AI 解析 → 预览（可改标题/日期/时间）→ 保存为日程并自动移出笔记本。入口在主界面 ⋯ 菜单与设置页；AI 输入规则（无日期无时间→当天待办）不受笔记本影响。

## 工程约定（每次改动必须）

1. 改代码后必须验证：`tsc --noEmit` → `pnpm build` → `pnpm test:smoke` → `pnpm test:ui`（在 `frontend/` 下，测试需先启动服务）。
2. 发版时同步更新 `frontend/src/lib/version.ts` 的 `APP_VERSION` 与 Git 标签号（自动更新检测依赖它）。
3. 数据库结构变更：同时改 `database/schema.sql` 和 `frontend/src/lib/db.ts` 的迁移逻辑，兼容旧库。
4. 跨目录引用（frontend ↔ backend）用相对路径，不用 tsconfig 别名（Turbopack 与 tsc 解析基准不一致）。
5. AI 服务配置统一走 `backend/ai/config.ts`（环境变量优先，`/opt/ai-calendar/config.env` 兜底），不要硬编码密钥。
6. 每个功能里程碑：更新 `docs/DEVELOPMENT.md`、写 `docs/versions/vX.Y.Z.md`、打 Git 标签、推送 GitHub（CI 自动部署）。

## 技术栈速记

- Next.js 16 App Router + Turbopack；Node 内置 SQLite（`node:sqlite`）；Tailwind CSS 4
- 客户端组件文件顶部要加 `"use client"`
- 日期工具统一用 `backend/ai/date-utils.ts`（服务端）或 `frontend/src/lib/date.ts`（前端）
- 本地解析器：`backend/ai/providers/local.ts`；AI 模型入口：`backend/ai/service.ts`（联网 AI / 离线规则自动切换）
