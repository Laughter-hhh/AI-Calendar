// 针对导入安全、时间编辑和重叠时间段的回归测试。
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const failures = [];
let cookie = "";

async function api(path, { method = "GET", body } = {}) {
  const headers = { Accept: "application/json,text/html" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(BASE_URL + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // 页面响应不是 JSON。
  }
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return { status: response.status, data, text };
}

function check(name, condition, detail = "") {
  if (condition) console.log(`  ✅ ${name}`);
  else {
    failures.push(name);
    console.log(`  ❌ ${name} ${detail}`);
  }
}

async function main() {
  console.log(`日历增强测试：${BASE_URL}`);
  const email = `calendar-features-${Date.now()}@test.local`;
  const register = await api("/api/auth/register", {
    method: "POST",
    body: { email, password: "123456" },
  });
  check("注册隔离测试账号", register.status === 200);

  const original = await api("/api/events", {
    method: "POST",
    body: {
      title: "原有日程",
      date: "2026-09-01",
      time: "09:00",
      endTime: "10:00",
    },
  });
  const originalId = original.data?.event?.id;
  check("建立原有日程基线", original.status === 201 && originalId);

  const utcEvent = [
    "BEGIN:VEVENT",
    "UID:external-utc@example.test",
    "SUMMARY:外部 UTC 会议",
    "DTSTART:20260901T040000Z",
    "DTEND:20260901T060000Z",
    "DESCRIPTION:应换算为上海 12:00-14:00",
    "END:VEVENT",
  ].join("\r\n");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    utcEvent,
    "BEGIN:VEVENT",
    "UID:external-tz@example.test",
    "SUMMARY:外部上海任务",
    "DTSTART;TZID=Asia/Shanghai:20260901T130000",
    "DTEND;TZID=Asia/Shanghai:20260901T140000",
    "END:VEVENT",
    utcEvent,
    "BEGIN:VEVENT",
    "UID:broken@example.test",
    "SUMMARY:缺少开始时间",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const preview = await api("/api/events/import", {
    method: "POST",
    body: { content: ics, fileName: "external.ics", mode: "preview" },
  });
  check(
    "导入预览识别新增/文件内重复/失败",
    preview.status === 200 &&
      preview.data?.ready === 2 &&
      preview.data?.duplicates === 1 &&
      preview.data?.failed === 1,
    JSON.stringify(preview.data)
  );
  const beforeImport = await api("/api/events?date=2026-09-01");
  check(
    "预览不写入数据",
    beforeImport.data?.events?.length === 1 && beforeImport.data.events[0].id === originalId,
    JSON.stringify(beforeImport.data)
  );

  const imported = await api("/api/events/import", {
    method: "POST",
    body: { content: ics, fileName: "external.ics", mode: "import" },
  });
  check(
    "确认后只追加两条且跳过重复",
    imported.status === 200 && imported.data?.imported === 2 && imported.data?.duplicates === 1,
    JSON.stringify(imported.data)
  );
  const afterImport = await api("/api/events?date=2026-09-01");
  const events = afterImport.data?.events ?? [];
  const originalAfter = events.find((event) => event.id === originalId);
  const utcAfter = events.find((event) => event.title === "外部 UTC 会议");
  const tzAfter = events.find((event) => event.title === "外部上海任务");
  check(
    "导入不改变原日程",
    originalAfter?.startTime === "09:00" && originalAfter?.endTime === "10:00",
    JSON.stringify(originalAfter)
  );
  check(
    "UTC 时间正确换算为上海时间",
    utcAfter?.startTime === "12:00" && utcAfter?.endTime === "14:00",
    JSON.stringify(utcAfter)
  );
  check(
    "TZID 时间正确导入",
    tzAfter?.startTime === "13:00" && tzAfter?.endTime === "14:00",
    JSON.stringify(tzAfter)
  );

  const reimport = await api("/api/events/import", {
    method: "POST",
    body: { content: ics, fileName: "external.ics", mode: "import" },
  });
  check(
    "重复导入不新增副本",
    reimport.status === 200 && reimport.data?.imported === 0 && reimport.data?.duplicates === 3,
    JSON.stringify(reimport.data)
  );

  const edited = await api(`/api/events/${utcAfter?.id}`, {
    method: "PATCH",
    body: { time: "12:30", endTime: "14:30" },
  });
  check(
    "添加后可修改起止时间",
    edited.status === 200 &&
      edited.data?.event?.startTime === "12:30" &&
      edited.data?.event?.endTime === "14:30",
    JSON.stringify(edited.data)
  );
  const invalidOrder = await api(`/api/events/${utcAfter?.id}`, {
    method: "PATCH",
    body: { time: "15:00", endTime: "14:00" },
  });
  check(
    "拒绝结束早于开始",
    invalidOrder.status === 400 && String(invalidOrder.data?.error).includes("结束时间"),
    JSON.stringify(invalidOrder.data)
  );
  const invalidFormat = await api("/api/events", {
    method: "POST",
    body: { title: "非法时间", date: "2026-09-01", time: "25:00" },
  });
  check("拒绝非法时间格式", invalidFormat.status === 400, JSON.stringify(invalidFormat.data));

  const dayPage = await api("/?date=2026-09-01");
  check(
    "日视图提供事项/时间线直接切换",
    dayPage.status === 200 && dayPage.text.includes(">事项<") && dayPage.text.includes(">时间线<")
  );
  const weekPage = await api("/?date=2026-09-01&view=week");
  check(
    "重叠任务被分配为两列",
    weekPage.status === 200 && weekPage.text.includes('data-timeline-columns="2"'),
    `status=${weekPage.status}`
  );

  if (failures.length === 0) console.log("\n🎉 日历增强测试全部通过");
  else console.log(`\n❌ 失败 ${failures.length} 项：${failures.join("、")}`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
