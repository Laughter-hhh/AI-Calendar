# AI Calendar API 文档

基础地址：`http://39.106.121.28:3000`（部署后以实际地址为准）。

所有需要登录的接口通过 Cookie `ai_calendar_session` 鉴权（注册/登录时由服务器下发）。未登录返回 `401 {"error":"请先登录"}`。

错误响应统一为：`{ "error": "描述" }`。

## 认证

### 注册

`POST /api/auth/register`

```json
{ "email": "user@example.com", "password": "123456" }
```

成功：`200 { "user": { "id": 1, "email": "..." } }`，并下发会话 Cookie。

### 登录

`POST /api/auth/login`（参数同注册）

### 退出

`POST /api/auth/logout`

### 当前用户

`GET /api/auth/me` → `{ "user": {...} | null }`

## 日程

### 查询某天

`GET /api/events?date=YYYY-MM-DD`（默认今天）→ `{ "events": [...] }`

返回的事件含重复展开（每天/每周/每月）与例外日排除。字段：

```json
{
  "id": 1,
  "title": "开会",
  "date": "2026-08-25",
  "startTime": "15:00",
  "endTime": null,
  "note": null,
  "repeat": null,
  "repeatUntil": null,
  "sourceText": null
}
```

### 查询区间（周视图等）

`GET /api/events?from=YYYY-MM-DD&to=YYYY-MM-DD` → 区间内每天展开重复后的全部事件（每个日期一条）

### 导出 .ics

`GET /api/events/export?from=YYYY-MM-DD&to=YYYY-MM-DD` → 返回 `text/calendar` 的 .ics 文件（可导入 Google Calendar / Apple 日历 / Outlook）。重复事件带 RRULE 与 EXDATE。

### 导入 .ics

`POST /api/events/import`，body：`{ "content": "<ics 文本>" }` → `{ "imported": n, "failed": m, "skipped": k }`。单次上限 200 条。

### 创建

`POST /api/events`

```json
{
  "title": "晨跑",
  "date": "2026-08-25",
  "time": "07:00",
  "endTime": null,
  "note": null,
  "repeat": "daily",
  "repeatUntil": null,
  "sourceText": "每天早上七点晨跑"
}
```

成功：`201 { "event": {...} }`。

### 修改

`PATCH /api/events/:id`，字段可部分传入（`title/date/time/endTime/note/repeat/repeatUntil`）。

注意：修改重复事件会影响整个系列（系列内单日编辑未实现，见 ROADMAP）。

### 删除

`DELETE /api/events/:id` → 删除整个事件（重复事件=整个系列）。

`DELETE /api/events/:id?mode=single&date=YYYY-MM-DD` → 仅删除重复事件中该日期的一次出现（其余保留）。

## 笔记本

笔记本用于记录"不确定什么时候做、但需要做的事"，条目不是日程（无日期无时间）。

### 查询列表

`GET /api/notes` → `{ "notes": [...] }`

未完成在前、新的在前。条目字段：`id / text / done / createdAt`。

### 新增

`POST /api/notes`

```json
{ "text": "不确定什么时候做：去配眼镜" }
```

成功：`201 { "note": { "id": 1, "text": "...", "done": false, "createdAt": "" } }`。空内容返回 400，最多 500 字。

### 修改

`PATCH /api/notes/:id`，可传 `text` / `done`（布尔）之一或两者 → `{ "note": {...} }`。

### 删除

`DELETE /api/notes/:id` → `{ "ok": true }`；不存在返回 404。

## AI

### 自然语言创建日程

`POST /api/ai/parse`

```json
{ "text": "从今天开始连续四天晚上八点学习 Python" }
```

可带 `context`（追问后补充的信息）：

```json
{ "text": "明天", "context": { "title": "学习 Python", "time": "20:00" } }
```

返回：

```json
{
  "result": {
    "events": [{ "title": "学习 Python", "date": "2026-08-25", "time": "20:00", "repeat": null, "repeatUntil": null }],
    "missing": [],
    "message": "已为你安排好日程，确认后保存。"
  },
  "provider": "local-rule-based"
}
```

`missing` 非空时前端应追问（产品原则：不猜测）。

### 自然语言修改/删除日程

`POST /api/ai/action`

```json
{ "text": "把学习改到晚上九点" }
```

返回：

```json
{
  "result": {
    "action": "update",
    "event": { "id": 1, "title": "学习 Python", "date": "2026-08-25", "time": "20:00", "repeat": null, "repeatUntil": null },
    "changes": { "time": "21:00" },
    "message": "将修改日程「学习 Python」：时间改为 21:00。",
    "candidates": []
  }
}
```

`action` 取值：`update` / `delete` / `null`（null 表示未找到目标或需要澄清，此时 `message` 给出提示；`message` 为空字符串表示非修改/删除意图，应走创建流程）。

## 健康检查

`GET /api/health` → `{ "ok": true, "name": "ai-calendar", "time": "...", "db": "ok" }`

`db` 字段为 `error` 时说明数据库异常，需检查服务器磁盘与 pm2 日志。

## 测试命令

```bash
# API 冒烟测试（需服务已启动）
BASE_URL=http://localhost:3000 node scripts/smoke-test.mjs

# 页面渲染检查
BASE_URL=http://localhost:3000 node scripts/ui-render-check.mjs
```
