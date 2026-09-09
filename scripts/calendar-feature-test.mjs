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
  const unauthenticatedMarks = await api("/api/calendar-marks?from=2026-09-01&to=2026-09-30");
  check("未登录不能读取月日历标记", unauthenticatedMarks.status === 401);
  const register = await api("/api/auth/register", {
    method: "POST",
    body: { email, password: "123456" },
  });
  check("注册隔离测试账号", register.status === 200);

  const createdMark = await api("/api/calendar-marks", {
    method: "POST",
    body: { date: "2026-09-10", title: "实验室纪念日", type: "anniversary", note: "双月视图回归样本" },
  });
  const markId = createdMark.data?.mark?.id;
  check("添加月日历纪念日标记", createdMark.status === 201 && markId !== undefined, JSON.stringify(createdMark.data));
  const marksList = await api("/api/calendar-marks?from=2026-09-01&to=2026-09-30");
  check("月日历标记按日期查询", marksList.status === 200 && marksList.data?.marks?.some((mark) => mark.id === markId && mark.title === "实验室纪念日"));
  const editedMark = await api(`/api/calendar-marks/${markId}`, {
    method: "PATCH",
    body: { title: "实验室周年纪念", date: "2026-09-11", type: "custom" },
  });
  check("月日历标记可编辑日期和名称", editedMark.status === 200 && editedMark.data?.mark?.title === "实验室周年纪念" && editedMark.data?.mark?.date === "2026-09-11", JSON.stringify(editedMark.data));
  const monthPage = await api("/?date=2026-09-01&view=month");
  check("月视图提供日历和日程双界面", monthPage.status === 200 && monthPage.text.includes("日历") && monthPage.text.includes("日程"));
  const deletedMark = await api(`/api/calendar-marks/${markId}`, { method: "DELETE" });
  check("月日历标记可删除", deletedMark.status === 200 && deletedMark.data?.ok === true);

  const multiParse = await api("/api/ai/parse", {
    method: "POST",
    body: { text: "九月十日十五点开会，十八点吃饭" },
  });
  const multiEvents = multiParse.data?.result?.events ?? [];
  const savedMultiIds = [];
  for (const event of multiEvents) {
    const saved = await api("/api/events", {
      method: "POST",
      body: { ...event, sourceText: "九月十日十五点开会，十八点吃饭" },
    });
    if (saved.data?.event?.id) savedMultiIds.push(saved.data.event.id);
  }
  const multiDayEvents = await api("/api/events?date=2026-09-10");
  check(
    "多项日程解析后分别保存并显示在同一天",
    multiParse.status === 200 &&
      multiEvents.length === 2 &&
      savedMultiIds.length === 2 &&
      multiDayEvents.data?.events?.some((event) => event.title === "开会" && event.startTime === "15:00") &&
      multiDayEvents.data?.events?.some((event) => event.title === "吃饭" && event.startTime === "18:00"),
    JSON.stringify({ parse: multiParse.data, events: multiDayEvents.data })
  );
  for (const id of savedMultiIds) await api("/api/events/" + id, { method: "DELETE" });

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

  const biweekly = await api("/api/events", {
    method: "POST",
    body: { title: "双周测试", date: "2026-09-01", time: "15:00", endTime: "16:00", repeat: "biweekly" },
  });
  const biweeklyId = biweekly.data?.event?.id;
  const biweeklyWeek = await api("/api/events?date=2026-09-08");
  const biweeklyNext = await api("/api/events?date=2026-09-15");
  check(
    "双周日程仅在第 14 天展开",
    biweekly.status === 201 &&
      biweeklyWeek.data?.events?.every((event) => event.id !== biweeklyId) &&
      biweeklyNext.data?.events?.some((event) => event.id === biweeklyId && event.date === "2026-09-15"),
    JSON.stringify({ biweekly: biweekly.data, week: biweeklyWeek.data, next: biweeklyNext.data })
  );
  if (biweeklyId) await api("/api/events/" + biweeklyId, { method: "DELETE" });

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

  const batchRepeat = await api("/api/events", {
    method: "POST",
    body: {
      title: "批量删除周次基线",
      date: "2026-09-07",
      time: "10:00",
      endTime: "11:00",
      repeat: "weekly",
    },
  });
  const batchRepeatId = batchRepeat.data?.event?.id;
  const batchDeleted = await api("/api/events/" + batchRepeatId, {
    method: "DELETE",
    body: { mode: "multiple", dates: ["2026-09-07", "2026-09-21"] },
  });
  const batchBaseDate = await api("/api/events?date=2026-09-07");
  const batchKeepDate = await api("/api/events?date=2026-09-14");
  const batchRemovedDate = await api("/api/events?date=2026-09-21");
  check(
    "批量删除指定周次并保留其他周次",
    batchDeleted.status === 200 &&
      !batchBaseDate.data?.events?.some((event) => event.id === batchRepeatId) &&
      batchKeepDate.data?.events?.some((event) => event.id === batchRepeatId) &&
      !batchRemovedDate.data?.events?.some((event) => event.id === batchRepeatId),
    JSON.stringify({ batchDeleted: batchDeleted.data, base: batchBaseDate.data, keep: batchKeepDate.data, removed: batchRemovedDate.data })
  );
  if (batchRepeatId) await api("/api/events/" + batchRepeatId, { method: "DELETE" });

  const customRepeat = await api("/api/events", {
    method: "POST",
    body: {
      title: "非连续周次测试",
      date: "2026-09-01",
      time: "15:00",
      endTime: "16:00",
      repeat: "weekly-custom",
      repeatConfig: JSON.stringify({ weekNumbers: [1, 3, 6, 7] }),
    },
  });
  const customRepeatId = customRepeat.data?.event?.id;
  const customWeek1 = await api("/api/events?date=2026-09-01");
  const customWeek2 = await api("/api/events?date=2026-09-08");
  const customWeek3 = await api("/api/events?date=2026-09-15");
  const customWeek6 = await api("/api/events?date=2026-10-06");
  const customWeek7 = await api("/api/events?date=2026-10-13");
  check(
    "非连续第1/3/6/7周保存后按规则展开",
    customRepeat.status === 201 &&
      customWeek1.data?.events?.some((event) => event.id === customRepeatId) &&
      !customWeek2.data?.events?.some((event) => event.id === customRepeatId) &&
      customWeek3.data?.events?.some((event) => event.id === customRepeatId) &&
      customWeek6.data?.events?.some((event) => event.id === customRepeatId) &&
      customWeek7.data?.events?.some((event) => event.id === customRepeatId),
    JSON.stringify({ customRepeat: customRepeat.data, week2: customWeek2.data })
  );

  const monthlyCustom = await api("/api/events", {
    method: "POST",
    body: {
      title: "按月周次测试",
      date: "2026-09-03",
      time: "20:00",
      repeat: "weekly-custom",
      repeatConfig: JSON.stringify({ monthWeekNumbers: [1, 3] }),
    },
  });
  const monthlyCustomId = monthlyCustom.data?.event?.id;
  const monthWeek1 = await api("/api/events?date=2026-09-03");
  const monthWeek2 = await api("/api/events?date=2026-09-10");
  const monthWeek3 = await api("/api/events?date=2026-09-17");
  check(
    "按月第1/3周重复并跳过第2周",
    monthlyCustom.status === 201 &&
      monthWeek1.data?.events?.some((event) => event.id === monthlyCustomId) &&
      !monthWeek2.data?.events?.some((event) => event.id === monthlyCustomId) &&
      monthWeek3.data?.events?.some((event) => event.id === monthlyCustomId),
    JSON.stringify({ monthlyCustom: monthlyCustom.data, week2: monthWeek2.data })
  );

  const excludedWeek = await api("/api/events", {
    method: "POST",
    body: {
      title: "排除日期所在周测试",
      date: "2026-09-03",
      time: "21:00",
      repeat: "weekly-custom",
      repeatConfig: JSON.stringify({ excludeWeekContainingDates: ["2026-09-10"] }),
    },
  });
  const excludedWeekId = excludedWeek.data?.event?.id;
  const excludedDateResult = await api("/api/events?date=2026-09-10");
  const keptAfterExcludedWeek = await api("/api/events?date=2026-09-17");
  check(
    "排除某日期所在整周而保留后续周",
    excludedWeek.status === 201 &&
      !excludedDateResult.data?.events?.some((event) => event.id === excludedWeekId) &&
      keptAfterExcludedWeek.data?.events?.some((event) => event.id === excludedWeekId),
    JSON.stringify({ excluded: excludedDateResult.data, kept: keptAfterExcludedWeek.data })
  );
  for (const id of [customRepeatId, monthlyCustomId, excludedWeekId]) {
    if (id) await api("/api/events/" + id, { method: "DELETE" });
  }

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

  const biweeklyIcs = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:biweekly-import@example.test",
    "SUMMARY:外部双周课程",
    "DTSTART;TZID=Asia/Shanghai:20260901T150000",
    "DTEND;TZID=Asia/Shanghai:20260901T160000",
    "RRULE:FREQ=WEEKLY;INTERVAL=2",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const biweeklyImport = await api("/api/events/import", {
    method: "POST",
    body: { content: biweeklyIcs, fileName: "biweekly.ics", mode: "import" },
  });
  const importedBiweekly = await api("/api/events?date=2026-09-15");
  check(
    "ICS 双周规则导入后第 14 天可展开",
    biweeklyImport.status === 200 &&
      biweeklyImport.data?.imported === 1 &&
      importedBiweekly.data?.events?.some((event) => event.title === "外部双周课程" && event.repeat === "biweekly"),
    JSON.stringify({ import: biweeklyImport.data, events: importedBiweekly.data })
  );

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
