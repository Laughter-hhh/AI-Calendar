// 发布前测试数据生成器：只对 CI 的临时数据库写入可识别、可清理的样本。
// 使用：BASE_URL=http://127.0.0.1:3100 DATABASE_PATH=... node scripts/generate-test-data.mjs

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const runId = process.env.GITHUB_RUN_ID ?? process.env.CI_RUN_ID ?? `${Date.now()}`;
const prefix = `[CI-${runId}]`;
let cookie = "";
const createdEventIds = [];
let createdNoteId;

function todayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function shift(dateStr, days) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function currentWeekdayDate(target) {
  const today = todayStr();
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const monday = shift(today, -(weekday === 0 ? 6 : weekday - 1));
  return shift(monday, target === 0 ? 6 : target - 1);
}

async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(BASE_URL + path, {
    method,
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // 保留非 JSON 响应，便于失败时输出。
  }
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return { status: response.status, data, text };
}

function requireOk(result, label, expectedStatus = 200) {
  if (result.status !== expectedStatus) {
    throw new Error(`${label} 失败：HTTP ${result.status} ${result.text}`);
  }
  return result.data;
}

async function cleanup() {
  for (const id of createdEventIds) {
    await api(`/api/events/${id}`, { method: "DELETE" });
  }
  if (createdNoteId !== undefined) {
    await api(`/api/notes/${createdNoteId}`, { method: "DELETE" });
  }
}

async function main() {
  if (!process.env.CI && !process.env.DATABASE_PATH) {
    throw new Error("测试数据生成器只允许在 CI 或显式 DATABASE_PATH 的隔离环境中运行");
  }

  const email = `ci-${runId}-${Date.now()}@test.local`;
  requireOk(await api("/api/auth/register", { method: "POST", body: { email, password: "123456" } }), "创建测试账号");

  const today = todayStr();
  const samples = [
    { title: `${prefix} 单条定时`, date: today, time: "09:00", endTime: "10:00" },
    { title: `${prefix} 重叠一`, date: today, time: "12:00", endTime: "14:00" },
    { title: `${prefix} 重叠二`, date: today, time: "13:00", endTime: "14:00" },
    { title: `${prefix} 全天待办`, date: today, time: null },
    { title: `${prefix} 每日重复`, date: today, time: "07:00", repeat: "daily", repeatUntil: shift(today, 2) },
    { title: `${prefix} 本周三`, date: currentWeekdayDate(3), time: "21:00", repeat: null },
    { title: `${prefix} 本周四`, date: currentWeekdayDate(4), time: "21:00", repeat: null },
  ];

  let overlapConflicts = 0;
  for (const sample of samples) {
    const data = requireOk(
      await api("/api/events", { method: "POST", body: { ...sample, sourceText: `${prefix} 测试数据` } }),
      `保存测试事件 ${sample.title}`,
      201
    );
    const id = data?.event?.id;
    if (id === undefined) throw new Error(`保存测试事件 ${sample.title} 未返回 id`);
    createdEventIds.push(id);
    if (Array.isArray(data.conflicts) && data.conflicts.length > 0) overlapConflicts += 1;
  }

  if (overlapConflicts < 1) throw new Error("重叠测试数据没有产生冲突提示");
  const from = samples.map((sample) => sample.date).sort()[0];
  const to = samples.map((sample) => sample.date).sort().at(-1);
  const range = requireOk(await api(`/api/events?from=${from}&to=${to}`), "查询测试数据");
  const rangeEvents = range?.events ?? [];
  if (!createdEventIds.every((id) => rangeEvents.some((event) => event.id === id))) {
    throw new Error("测试数据查询结果缺少已创建事件");
  }
  const finite = rangeEvents.filter((event) => event.title === `${prefix} 本周三` || event.title === `${prefix} 本周四`);
  if (finite.length !== 2 || finite.some((event) => event.repeat !== null)) {
    throw new Error("本周多日期测试数据未保持一次性事件语义");
  }

  const note = requireOk(await api("/api/notes", { method: "POST", body: { text: `${prefix} 笔记缓存样本` } }), "保存测试笔记", 201);
  createdNoteId = note?.note?.id;
  if (createdNoteId === undefined) throw new Error("保存测试笔记未返回 id");
  const notes = requireOk(await api("/api/notes"), "查询测试笔记");
  if (!notes?.notes?.some((item) => item.id === createdNoteId)) throw new Error("测试笔记查询结果缺少样本");

  console.log(`测试数据通过：账号=${email}，事件=${createdEventIds.length}，重叠冲突=${overlapConflicts}，笔记=1`);
  await cleanup();
  console.log("测试数据已清理（CI 临时数据库）");
}

main().catch(async (error) => {
  console.error(error);
  await cleanup();
  process.exit(1);
});
