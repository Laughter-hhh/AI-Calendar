# 页面布局改动教程

> 目的：教你（或任何 AI）通过改代码来调整 AI Calendar 的页面布局。改布局前建议先读 [DEVELOPMENT.md](DEVELOPMENT.md) 了解整体架构。

## 一、布局由哪些文件控制

| 文件 | 管什么 |
|---|---|
| `frontend/src/app/page.tsx` | 整页容器：最大宽度、内边距、安全区；登录页 |
| `frontend/src/components/ScheduleArea.tsx` | **主功能栏**：日期切换 + 视图 + ⋯ 菜单；搜索行、横幅、日程列表容器 |
| `frontend/src/components/DateNav.tsx` | 日期切换按钮（‹ 日期 › / 今）和视图切换（日/周/月） |
| `frontend/src/components/EventList.tsx` | 单日列表：定时/待办分组、事件行样式、编辑表单 |
| `frontend/src/components/WeekView.tsx` | “周”时间安排视图：7 天时间轴、时间块 |
| `frontend/src/components/MonthView.tsx` | “月”视图：月历网格 |
| `frontend/src/components/AiInput.tsx` | 底部 AI 输入条（固定底部，含语音按钮） |
| `frontend/src/components/SearchBar.tsx` | 搜索输入框 |
| `frontend/src/components/ExportButton.tsx` / `ImportButton.tsx` | 导出/导入按钮 |
| `frontend/src/lib/colors.ts` | 事件颜色色板 |
| `frontend/src/app/settings/page.tsx` / `shares/page.tsx` / `download/page.tsx` | 独立页面 |

## 二、改样式的核心知识（Tailwind CSS）

本项目用 **Tailwind CSS 4**，样式直接写在 className 里，不需要单独的 CSS 文件。

常用写法：

```tsx
<button className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100">
```

| 类 | 含义 |
|---|---|
| `p-3` / `px-3` / `py-2` / `m-2` / `mb-2` | 内边距 / 外边距 |
| `flex` / `items-center` / `justify-between` / `gap-2` | Flex 布局 |
| `text-sm` / `text-xs` / `text-lg` / `font-semibold` | 字号 / 字重 |
| `bg-white` / `bg-zinc-900` / `text-white` | 颜色 |
| `rounded-lg` / `rounded-xl` | 圆角 |
| `w-full` / `max-w-3xl` / `flex-1` / `min-w-0` | 宽度 |
| `hidden` / `md:block` | 响应式（`md:` = 桌面断点 ≥768px） |
| `pt-[env(safe-area-inset-top)]` | 刘海屏安全区 |

## 三、典型改动示例

### 1. 改主界面上下间距（让日程区更突出）

文件：`frontend/src/app/page.tsx`

```tsx
<main className="mx-auto w-full max-w-3xl px-3 pb-44 pt-[calc(env(safe-area-inset-top)+0.75rem)] md:max-w-5xl md:px-8">
```

- `max-w-3xl` → 想更宽改 `max-w-5xl`
- `pb-44` → 底部留白（给输入条让位），调小日程区能下探

### 2. 加/删一个功能按钮

主界面按钮都收在 **⋯ 菜单**（`ScheduleArea.tsx` 底部的菜单区）。加一项：

```tsx
<button className={menuItem} onClick={...}>
  🔗 新功能
</button>
```

删一项：直接删掉对应的 `<button>` 或 `<a>` 行。

### 3. 调整视图切换（日/周/月）

文件：`DateNav.tsx`，tab 列表在 `["day", "week", "month"]`，想改文字改这里：

```tsx
{v === "day" ? "日" : v === "week" ? "周" : "月"}
```

### 4. 改事件颜色（更亮/更暗）

文件：`frontend/src/lib/colors.ts`（圆点/列表用）+ `WeekView.tsx` 里的 `BLOCK_COLORS`（时间块用）。

```ts
{ value: "blue", label: "蓝", dot: "bg-sky-500" }
```

颜色深浅：Tailwind 数字越大越深（`bg-sky-400` 亮、`bg-sky-600` 深）。

### 5. 改时间轴时间范围（现在 6:00-23:00）

文件：`WeekView.tsx` 顶部：

```ts
const START_HOUR = 6;
const HOURS = Array.from({ length: 18 }, (_, i) => i + START_HOUR); // 6..23
```

想从 8 点开始显示 12 小时：`START_HOUR = 8; HOURS = Array.from({ length: 12 }, (_, i) => i + 8);`

## 四、改完必须做的验证

```bash
# 1. 类型检查
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json   # 在 frontend/ 下

# 2. 构建
pnpm build

# 3. 测试（需先启动服务）
pnpm test:smoke    # API 冒烟
pnpm test:ui       # 页面渲染检查
```

## 五、常见坑（改布局最容易踩）

1. **JSX 文本被拆分**：`{h}:00` 会渲染成 `6<!-- -->:00`（测试匹配不到）。要写成一个整体：`{`${h}:00`}`。
2. **客户端组件状态不随服务端刷新**：把服务端数据当 `useState` 初值时，数据变了要加 `useEffect(() => setEvents(initialEvents), [initialEvents])` 同步。
3. **安全区**：全屏类布局记得 `env(safe-area-inset-top/bottom)`，否则被刘海屏/底部手势条遮挡。
4. **测试断言会过时**：改了文案/布局后，同步更新 `scripts/ui-render-check.mjs` 里的断言。
5. **响应式**：默认样式先写手机版，桌面版用 `md:` 前缀覆盖。

## 六、给 AI 的约定（配合 skill）

本项目的产品与工程规则已固化在用户级 skill `ai-calendar-dev` 中（见 `docs/skills/ai-calendar-dev/`），任何 AI 改动前请先按该 skill 与本文档执行。
