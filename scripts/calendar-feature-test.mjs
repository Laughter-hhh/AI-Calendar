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
  const unauthenticatedImport = await api("/api/events/import", {
    method: "POST",
    body: {
      fileName: "unauthenticated.ics",
      mode: "preview",
      content: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR",
    },
  });
  check("未登录不能导入", unauthenticatedImport.status === 401);

  const email = `calendar-features-${Date.now()}@test.local`;
  const register = await api("/api/auth/register", {
    method: "POST",
    body: { email, password: "123456" },
  });
  check("注册隔离测试账号", register.status === 200);
  const unsupportedFile = await api("/api/events/import", {
    method: "POST",
    body: { fileName: "calendar.csv", mode: "preview", content: "title,date\n测试,2026-09-01" },
  });
  check(
    "明确拒绝 CSV 等非 ICS 文件",
    unsupportedFile.status === 415 && String(unsupportedFile.data?.error).includes(".ics"),
    JSON.stringify(unsupportedFile.data)
  );
  const invalidContainer = await api("/api/events/import", {
    method: "POST",
    body: {
      fileName: "broken.ics",
      mode: "preview",
      content: "BEGIN:VEVENT\r\nSUMMARY:缺少日历容器\r\nEND:VEVENT",
    },
  });
  check("拒绝缺少 VCALENDAR 容器的伪 ICS", invalidContainer.status === 400);

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

  const conflictCandidate = await api("/api/events", {
    method: "POST",
    body: { title: "冲突提示样本", date: "2026-09-01", time: "09:30", endTime: "10:30" },
  });
  check(
    "新建日程后返回同日冲突提示",
    conflictCandidate.status === 201 && conflictCandidate.data?.conflicts?.some((event) => event.title === "原有日程"),
    JSON.stringify(conflictCandidate.data)
  );
  if (conflictCandidate.data?.event?.id) {
    await api(`/api/events/${conflictCandidate.data.event.id}`, { method: "DELETE" });
  }

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

  const repeatBase = await api("/api/events", {
    method: "POST",
    body: {
      title: "重复系列编辑基线",
      date: "2026-09-07",
      time: "14:00",
      endTime: "15:00",
      repeat: "weekly",
    },
  });
  const repeatId = repeatBase.data?.event?.id;
  const singleEdit = await api(`/api/events/${repeatId}`, {
    method: "PATCH",
    body: {
      mode: "single",
      occurrenceDate: "2026-09-14",
      date: "2026-09-14",
      title: "只改这一周",
      time: "16:00",
      endTime: "17:00",
    },
  });
  const singleDate = await api("/api/events?date=2026-09-14");
  const futureDate = await api("/api/events?date=2026-09-21");
  const singleEvent = singleDate.data?.events?.find((event) => event.title === "只改这一周");
  const futureSeries = futureDate.data?.events?.find((event) => event.id === repeatId);
  check(
    "重复日程仅本次编辑不影响后续系列",
    singleEdit.status === 200 && singleEvent?.startTime === "16:00" && futureSeries?.startTime === "14:00",
    JSON.stringify({ singleEdit: singleEdit.data, singleEvent, futureSeries })
  );
  const deletedSeries = await api(`/api/events/${repeatId}`, { method: "DELETE" });
  const afterSeriesDelete = await api("/api/events?date=2026-09-14");
  check(
    "删除整个系列时同时清理单次编辑副本",
    deletedSeries.status === 200 && !afterSeriesDelete.data?.events?.some((event) => event.title === "只改这一周"),
    JSON.stringify(afterSeriesDelete.data)
  );

  const compatibilityIcs = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:all-day@example.test",
    "SUMMARY:外部全天待办",
    "DTSTART;VALUE=DATE:20260902",
    "DESCRIPTION:支持折行且不覆盖原有",
    " 内容",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:complex-repeat@example.test",
    "SUMMARY:复杂重复课程",
    "DTSTART;TZID=Asia/Shanghai:20260901T160000",
    "DTEND;TZID=Asia/Shanghai:20260901T170000",
    "RRULE:FREQ=WEEKLY;BYDAY=TU,TH",
    "EXDATE;TZID=Asia/Shanghai:20260908T160000",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const compatibilityPreview = await api("/api/events/import", {
    method: "POST",
    body: { content: compatibilityIcs, fileName: "compatibility.ics", mode: "preview" },
  });
  check(
    "预览全天事项、折行文本与复杂重复规则",
    compatibilityPreview.status === 200 &&
      compatibilityPreview.data?.ready === 2 &&
      compatibilityPreview.data?.warnings?.some((warning) => warning.includes("复杂重复规则")) &&
      compatibilityPreview.data?.warnings?.some((warning) => warning.includes("例外日期")),
    JSON.stringify(compatibilityPreview.data)
  );
  const compatibilityImport = await api("/api/events/import", {
    method: "POST",
    body: { content: compatibilityIcs, fileName: "compatibility.ics", mode: "import" },
  });
  check("兼容事件确认后可安全导入", compatibilityImport.status === 200 && compatibilityImport.data?.imported === 2);
  const allDayList = await api("/api/events?date=2026-09-02");
  const importedAllDay = allDayList.data?.events?.find((event) => event.title === "外部全天待办");
  check(
    "全天事件与折行描述正确保存",
    importedAllDay?.startTime === null && importedAllDay?.note === "支持折行且不覆盖原有内容",
    JSON.stringify(importedAllDay)
  );
  const complexList = await api("/api/events?date=2026-09-01");
  const importedComplex = complexList.data?.events?.find((event) => event.title === "复杂重复课程");
  check("复杂重复规则降级为首日且给过预警", importedComplex?.repeat === null, JSON.stringify(importedComplex));

  const thirdOverlap = await api("/api/events", {
    method: "POST",
    body: {
      title: "第三个重叠任务",
      date: "2026-09-01",
      time: "13:30",
      endTime: "15:00",
    },
  });
  check("建立三重重叠布局样本", thirdOverlap.status === 201);
  const earlyEvent = await api("/api/events", {
    method: "POST",
    body: {
      title: "凌晨任务",
      date: "2026-09-01",
      time: "01:00",
      endTime: "02:00",
    },
  });
  check("建立凌晨布局样本", earlyEvent.status === 201);

  const dayPage = await api("/?date=2026-09-01");
  check(
    "日视图提供事项/时间线直接切换",
    dayPage.status === 200 && dayPage.text.includes(">事项<") && dayPage.text.includes(">时间线<")
  );
  const weekPage = await api("/?date=2026-09-01&view=week");
  check(
    "三重重叠任务被分配为三列",
    weekPage.status === 200 && weekPage.text.includes('data-timeline-columns="3"'),
    `status=${weekPage.status}`
  );
  check(
    "周时间线自动向前扩展以显示凌晨任务",
    weekPage.text.includes('data-timeline-start-hour="1"') && !weekPage.text.includes("top:-"),
    "凌晨任务可能仍在可视区域外"
  );

  if (failures.length === 0) console.log("\n🎉 日历增强测试全部通过");
  else console.log(`\n❌ 失败 ${failures.length} 项：${failures.join("、")}`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
