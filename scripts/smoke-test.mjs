// AI Calendar 冒烟测试：验证 MVP 核心闭环
// 使用：先启动服务（pnpm dev 或 pnpm start），然后运行：
//   node scripts/smoke-test.mjs
// 可通过环境变量 BASE_URL 指定服务地址，默认 http://localhost:3000

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
let cookie = "";
const failures = [];

function todayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function shift(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + 8 * 3600 * 1000);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function nextMondayStr() {
  const t = todayStr(0);
  const wd = new Date(`${t}T00:00:00Z`).getUTCDay();
  return shift(t, (1 - wd + 7) % 7);
}

async function api(path, { method = "GET", body, cookie: useCookie } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (useCookie !== undefined) headers.Cookie = useCookie;
  else if (cookie) headers.Cookie = cookie;
  const res = await fetch(BASE_URL + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // 非 JSON 响应（如首页 HTML）
  }
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return { status: res.status, data, text, cookie: setCookie ? setCookie.split(";")[0] : undefined };
}

function check(name, cond, detail = "") {
  if (cond) {
    console.log(`  ✅ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ❌ ${name} ${detail}`);
  }
}

async function main() {
  console.log(`冒烟测试：${BASE_URL}`);

  console.log("\n1) 首页可访问");
  const home = await api("/");
  check("首页返回 200 且包含产品名", home.status === 200 && home.text.includes("AI Calendar"), `status=${home.status}`);

  console.log("\n2) 注册");
  const email = `smoke-${Date.now()}@test.local`;
  const reg = await api("/api/auth/register", { method: "POST", body: { email, password: "123456" } });
  check("注册成功并返回用户", reg.status === 200 && reg.data?.user?.email === email, JSON.stringify(reg.data));

  console.log("\n3) AI 解析：从今天开始连续四天晚上八点学习 Python");
  const r1 = await api("/api/ai/parse", { method: "POST", body: { text: "从今天开始连续四天晚上八点学习 Python" } });
  const ev1 = r1.data?.result?.events ?? [];
  check("解析出 4 个事件", r1.status === 200 && ev1.length === 4, `count=${ev1.length}`);
  check("每天 20:00 且日期连续", ev1.every((e, i) => e.time === "20:00" && e.date === todayStr(i)), JSON.stringify(ev1));
  check("标题正确", ev1[0]?.title === "学习 Python", `title=${ev1[0]?.title}`);

  console.log("\n4) AI 解析：明天下午三点开会");
  const r2 = await api("/api/ai/parse", { method: "POST", body: { text: "明天下午三点开会" } });
  const ev2 = r2.data?.result?.events ?? [];
  check("解析出 1 个事件", r2.status === 200 && ev2.length === 1, `count=${ev2.length}`);
  check(
    "日期=明天 时间=15:00 标题=开会",
    ev2[0]?.date === todayStr(1) && ev2[0]?.time === "15:00" && ev2[0]?.title === "开会",
    JSON.stringify(ev2)
  );

  console.log("\n5) 信息缺失时追问");
  const r3 = await api("/api/ai/parse", { method: "POST", body: { text: "晚上八点学习 Python" } });
  check("返回 missing 包含 date", r3.status === 200 && r3.data?.result?.missing.includes("date"), JSON.stringify(r3.data?.result));
  const r4 = await api("/api/ai/parse", {
    method: "POST",
    body: { text: "明天", context: { title: "学习 Python", time: "20:00" } },
  });
  const ev4 = r4.data?.result?.events ?? [];
  check(
    "补充信息后解析成功",
    ev4.length === 1 && ev4[0].date === todayStr(1) && ev4[0].time === "20:00" && ev4[0].title === "学习 Python",
    JSON.stringify(ev4)
  );

  console.log("\n6) 保存 / 查询 / 修改 / 删除");
  const created = await api("/api/events", {
    method: "POST",
    body: { title: "开会", date: todayStr(1), time: "15:00", sourceText: "明天下午三点开会" },
  });
  const eventId = created.data?.event?.id;
  check("创建事件成功", created.status === 201 && eventId !== undefined, JSON.stringify(created.data));

  const list = await api(`/api/events?date=${todayStr(1)}`);
  check("查询到该事件", list.status === 200 && list.data?.events?.some((e) => e.id === eventId), JSON.stringify(list.data));

  const patched = await api(`/api/events/${eventId}`, {
    method: "PATCH",
    body: { title: "产品评审会议", time: "15:30" },
  });
  check(
    "修改成功",
    patched.status === 200 && patched.data?.event?.title === "产品评审会议" && patched.data?.event?.startTime === "15:30",
    JSON.stringify(patched.data)
  );

  const del = await api(`/api/events/${eventId}`, { method: "DELETE" });
  check("删除成功", del.status === 200 && del.data?.ok === true, JSON.stringify(del.data));

  console.log("\n7) 未登录访问被拒绝");
  cookie = "";
  const anon = await api("/api/events");
  check("返回 401", anon.status === 401, `status=${anon.status}`);

  console.log("\n8) 重复事件");
  // 第 7 步清空了登录态，这里重新注册一个用户
  await api("/api/auth/register", { method: "POST", body: { email: `smoke8-${Date.now()}@test.local`, password: "123456" } });
  const daily = await api("/api/events", {
    method: "POST",
    body: { title: "晨跑", date: todayStr(-1), time: "07:00", repeat: "daily" },
  });
  const dailyId = daily.data?.event?.id;
  check("创建每天重复事件", daily.status === 201 && dailyId !== undefined, JSON.stringify(daily.data));

  const dToday = await api(`/api/events?date=${todayStr(0)}`);
  check("今天能看到该重复事件", dToday.data?.events?.some((e) => e.id === dailyId && e.title === "晨跑"));
  const dTomorrow = await api(`/api/events?date=${todayStr(1)}`);
  check("明天也能看到", dTomorrow.data?.events?.some((e) => e.id === dailyId));

  const baseMonday = nextMondayStr();
  const weekly = await api("/api/events", {
    method: "POST",
    body: { title: "周会", date: baseMonday, time: "10:00", repeat: "weekly" },
  });
  const weeklyId = weekly.data?.event?.id;
  const mondayCheck = await api(`/api/events?date=${baseMonday}`);
  check("周一能看到周会", mondayCheck.data?.events?.some((e) => e.id === weeklyId));
  const tuesdayCheck = await api(`/api/events?date=${shift(baseMonday, 1)}`);
  check("周二看不到周会", !tuesdayCheck.data?.events?.some((e) => e.id === weeklyId));

  const delSingle = await api(`/api/events/${dailyId}?mode=single&date=${todayStr(0)}`, { method: "DELETE" });
  check("仅删除本日成功", delSingle.status === 200 && delSingle.data?.mode === "exception", JSON.stringify(delSingle.data));
  const afterDelToday = await api(`/api/events?date=${todayStr(0)}`);
  check("今天不再显示被删的重复日程", !afterDelToday.data?.events?.some((e) => e.id === dailyId));
  const afterDelTomorrow = await api(`/api/events?date=${todayStr(1)}`);
  check("明天仍显示", afterDelTomorrow.data?.events?.some((e) => e.id === dailyId));

  const year = todayStr(0).slice(0, 4);
  const r5 = await api("/api/ai/parse", { method: "POST", body: { text: "每天早上八点起床" } });
  check("AI 解析每天重复", r5.data?.result?.events?.[0]?.repeat === "daily", JSON.stringify(r5.data?.result));
  const r6 = await api("/api/ai/parse", { method: "POST", body: { text: "每周一晚上八点健身" } });
  check("AI 解析每周一", r6.data?.result?.events?.[0]?.repeat === "weekly", JSON.stringify(r6.data?.result));
  const r7 = await api("/api/ai/parse", { method: "POST", body: { text: "每天下午五点提醒喝水，持续到9月1日" } });
  check("AI 解析重复截止日期", r7.data?.result?.events?.[0]?.repeatUntil === `${year}-09-01`, JSON.stringify(r7.data?.result));

  console.log("\n9) AI 修改/删除日程");
  await api("/api/events", { method: "POST", body: { title: "学习 Python", date: todayStr(0), time: "20:00" } });
  const meeting = await api("/api/events", { method: "POST", body: { title: "会议", date: todayStr(1), time: "15:00" } });
  const meetingId = meeting.data?.event?.id;

  const a1 = await api("/api/ai/action", { method: "POST", body: { text: "把学习改到晚上九点" } });
  const ar1 = a1.data?.result;
  check("修改意图识别", ar1?.action === "update", JSON.stringify(ar1));
  check("目标日程正确", ar1?.event?.title === "学习 Python", ar1?.event?.title);
  check("新时间解析为 21:00", ar1?.changes?.time === "21:00", JSON.stringify(ar1?.changes));
  if (ar1?.action === "update" && ar1.event) {
    const patched = await api(`/api/events/${ar1.event.id}`, { method: "PATCH", body: { time: "21:00" } });
    check("执行修改成功", patched.status === 200 && patched.data?.event?.startTime === "21:00", JSON.stringify(patched.data));
  }

  const a2 = await api("/api/ai/action", { method: "POST", body: { text: "删除明天的会议" } });
  const ar2 = a2.data?.result;
  check("删除意图识别且目标正确", ar2?.action === "delete" && ar2?.event?.id === meetingId, JSON.stringify(ar2));
  if (ar2?.action === "delete" && ar2.event) {
    const del2 = await api(`/api/events/${ar2.event.id}`, { method: "DELETE" });
    check("执行删除成功", del2.status === 200);
  }

  const a3 = await api("/api/ai/action", { method: "POST", body: { text: "删除不存在的瑜伽课" } });
  check(
    "未找到时给出提示",
    a3.status === 200 && a3.data?.result?.action === null && String(a3.data?.result?.message).includes("没找到"),
    JSON.stringify(a3.data?.result)
  );

  const a4 = await api("/api/ai/action", { method: "POST", body: { text: "明天下午三点开会" } });
  check("创建意图不被误判为修改/删除", a4.data?.result?.action === null && a4.data?.result?.message === "", JSON.stringify(a4.data?.result));

  console.log("\n10) 区间查询与健康检查");
  const range = await api(`/api/events?from=${todayStr(-3)}&to=${todayStr(3)}`);
  check("区间查询返回 200", range.status === 200, `status=${range.status}`);
  check("区间查询包含今天的事件", range.data?.events?.some((e) => e.title === "学习 Python"), JSON.stringify(range.data));
  const badRange = await api("/api/events?from=bad&to=2026-01-01");
  check("非法区间返回 400", badRange.status === 400, `status=${badRange.status}`);
  const health = await api("/api/health");
  check("健康检查包含数据库状态", health.data?.db === "ok", JSON.stringify(health.data));

  console.log("\n11) ICS 导出");
  const ics = await api(`/api/events/export?from=${todayStr(-3)}&to=${todayStr(3)}`);
  check("ICS 导出返回 200", ics.status === 200, `status=${ics.status}`);
  check("ICS 内容包含 VCALENDAR", ics.text.includes("BEGIN:VCALENDAR") && ics.text.includes("END:VCALENDAR"));
  check("ICS 内容包含日程标题", ics.text.includes("学习 Python") || ics.text.includes("晨跑"));
  const icsBad = await api("/api/events/export?from=bad&to=2026-01-01");
  check("非法区间导出返回 400", icsBad.status === 400, `status=${icsBad.status}`);

  console.log("\n12) ICS 导入与事件颜色");
  const imp = await api("/api/events/import", { method: "POST", body: { content: ics.text } });
  check("ICS 导入成功（往返）", imp.status === 200 && imp.data?.imported >= 1, JSON.stringify(imp.data));
  const afterImport = await api(`/api/events?date=${todayStr(0)}`);
  check("导入后当天能查到日程", afterImport.data?.events?.length >= 1);
  const impEmpty = await api("/api/events/import", { method: "POST", body: { content: "" } });
  check("空内容导入返回 400", impEmpty.status === 400, `status=${impEmpty.status}`);

  const colored = await api("/api/events", {
    method: "POST",
    body: { title: "蓝色会议", date: todayStr(1), time: "10:00", color: "blue" },
  });
  check("创建带颜色事件", colored.status === 201 && colored.data?.event?.color === "blue", JSON.stringify(colored.data));
  const patchedColor = await api(`/api/events/${colored.data?.event?.id}`, { method: "PATCH", body: { color: "red" } });
  check("修改事件颜色", patchedColor.status === 200 && patchedColor.data?.event?.color === "red", JSON.stringify(patchedColor.data));

  console.log("\n13) 下载接口");
  const dl404 = await api("/api/download/ai-calendar.apk");
  check("文件不存在返回 404", dl404.status === 404, `status=${dl404.status}`);
  const dlBad = await api("/api/download/..%2F..%2Fetc%2Fpasswd");
  check("路径穿越被拒绝", dlBad.status === 404, `status=${dlBad.status}`);

  console.log("\n14) 完成事项");
  const task = await api("/api/events", { method: "POST", body: { title: "整理笔记", date: todayStr(0), time: "11:00" } });
  const taskId = task.data?.event?.id;
  check("创建任务成功", task.status === 201 && taskId !== undefined, JSON.stringify(task.data));
  const mark = await api(`/api/events/${taskId}`, { method: "PATCH", body: { done: true } });
  check("标记完成成功", mark.status === 200 && mark.data?.event?.done === true, JSON.stringify(mark.data));
  const listAfter = await api(`/api/events?date=${todayStr(0)}`);
  check("列表返回完成状态", listAfter.data?.events?.find((e) => e.id === taskId)?.done === true);
  const aDone = await api("/api/ai/action", { method: "POST", body: { text: "完成整理" } });
  check(
    "AI 识别完成意图",
    aDone.data?.result?.action === "done" && aDone.data?.result?.event?.id === taskId,
    JSON.stringify(aDone.data?.result)
  );

  console.log("\n15) 共享日历");
  const emailA = `sharea-${Date.now()}@test.local`;
  const emailB = `shareb-${Date.now()}@test.local`;
  const regA = await api("/api/auth/register", { method: "POST", body: { email: emailA, password: "123456" } });
  const cookieA = regA.cookie;
  const regB = await api("/api/auth/register", { method: "POST", body: { email: emailB, password: "123456" } });
  const cookieB = regB.cookie;
  check("注册两个测试用户", regA.status === 200 && regB.status === 200 && !!cookieA && !!cookieB);

  await api("/api/events", {
    method: "POST",
    body: { title: "共享测试会议", date: todayStr(1), time: "10:00" },
    cookie: cookieA,
  });
  const share = await api("/api/shares", { method: "POST", body: { email: emailB }, cookie: cookieA });
  check("A 共享日历给 B", share.status === 200, JSON.stringify(share.data));
  const shareDup = await api("/api/shares", { method: "POST", body: { email: emailB }, cookie: cookieA });
  check("重复共享幂等", shareDup.status === 200);
  const shareSelf = await api("/api/shares", { method: "POST", body: { email: emailA }, cookie: cookieA });
  check("不能共享给自己", shareSelf.status === 400, JSON.stringify(shareSelf.data));

  const bList = await api(`/api/events?date=${todayStr(1)}`, { cookie: cookieB });
  const sharedEv = bList.data?.events?.find((e) => e.title === "共享测试会议");
  check("B 能看到 A 的共享日程", bList.status === 200 && !!sharedEv && sharedEv.ownerEmail === emailA, JSON.stringify(sharedEv));

  const forbidPatch = await api(`/api/events/${sharedEv?.id}`, { method: "PATCH", body: { time: "11:00" }, cookie: cookieB });
  check("B 不能修改共享日程", forbidPatch.status === 404, `status=${forbidPatch.status}`);

  const sharesList = await api("/api/shares", { cookie: cookieA });
  check("A 的共享列表包含 B", sharesList.data?.sharedTo?.some((s) => s.email === emailB), JSON.stringify(sharesList.data));

  const revoke = await api(`/api/shares?email=${encodeURIComponent(emailB)}`, { method: "DELETE", cookie: cookieA });
  check("A 撤销共享", revoke.status === 200, JSON.stringify(revoke.data));
  const bList2 = await api(`/api/events?date=${todayStr(1)}`, { cookie: cookieB });
  check("撤销后 B 看不到共享日程", !bList2.data?.events?.some((e) => e.title === "共享测试会议"));

  console.log("\n16) 版本与语音接口");
  const ver = await api("/api/version");
  check("版本接口返回版本号", ver.status === 200 && typeof ver.data?.version === "string", JSON.stringify(ver.data));

  const sttNoAuth = await fetch(`${BASE_URL}/api/ai/stt`, { method: "POST", body: "x" });
  check("语音接口未登录返回 401", sttNoAuth.status === 401, `status=${sttNoAuth.status}`);
  const sttNoFile = await fetch(`${BASE_URL}/api/ai/stt`, { method: "POST", headers: { Cookie: cookie }, body: "x" });
  check("语音接口缺音频返回 400", sttNoFile.status === 400, `status=${sttNoFile.status}`);
  const audioForm = new FormData();
  audioForm.append("audio", new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" }), "a.webm");
  const sttNoKey = await fetch(`${BASE_URL}/api/ai/stt`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: audioForm,
  });
  check("未配置语音服务返回 503", sttNoKey.status === 503, `status=${sttNoKey.status}`);

  console.log("\n17) 离线解析修复");
  const p1 = await api("/api/ai/parse", { method: "POST", body: { text: "明天八点半开会" } });
  const e1 = p1.data?.result?.events?.[0];
  check("八点半解析为 08:30", e1?.time === "08:30" && e1?.date === todayStr(1), JSON.stringify(e1));
  const p2 = await api("/api/ai/parse", { method: "POST", body: { text: "八点半进行实验计划与果蝇收集" } });
  const e2 = p2.data?.result?.events?.[0];
  check("标题只保留动作内容（去掉进行）", e2?.title === "实验计划与果蝇收集", JSON.stringify(e2));
  check(
    "时间 08:30 且缺失日期触发追问",
    e2?.time === "08:30" && p2.data?.result?.missing.includes("date"),
    JSON.stringify(p2.data?.result)
  );
  const p3 = await api("/api/ai/parse", { method: "POST", body: { text: "明天下午三点半接孩子" } });
  check("下午三点半解析为 15:30", p3.data?.result?.events?.[0]?.time === "15:30", JSON.stringify(p3.data?.result));

  console.log("\n18) 无时间待办");
  const t1 = await api("/api/ai/parse", { method: "POST", body: { text: "待办：明天交报告" } });
  const te1 = t1.data?.result?.events?.[0];
  check(
    "待办解析为无时间日程",
    te1?.time === null && te1?.title === "交报告" && te1?.date === todayStr(1),
    JSON.stringify(te1)
  );
  check("待办不再追问时间", t1.data?.result?.missing.length === 0, JSON.stringify(t1.data?.result));
  const t2 = await api("/api/ai/parse", { method: "POST", body: { text: "明天整理笔记无时间" } });
  check("无时间关键词解析为全天", t2.data?.result?.events?.[0]?.time === null, JSON.stringify(t2.data?.result));
  const t3 = await api("/api/ai/parse", {
    method: "POST",
    body: { text: "无时间", context: { title: "整理笔记", date: todayStr(1) } },
  });
  check(
    "追问时回答无时间也能创建",
    t3.data?.result?.events?.[0]?.time === null && t3.data?.result?.missing.length === 0,
    JSON.stringify(t3.data?.result)
  );

  console.log("\n19) 无日期无时间自动识别为待办");
  const d1 = await api("/api/ai/parse", { method: "POST", body: { text: "交报告" } });
  const de1 = d1.data?.result?.events?.[0];
  check(
    "只写标题（无日期无时间）识别为当天待办",
    de1?.title === "交报告" && de1?.time === null && de1?.date === todayStr(0) && d1.data?.result?.missing.length === 0,
    JSON.stringify(d1.data?.result)
  );
  const d2 = await api("/api/ai/parse", { method: "POST", body: { text: "明天交报告" } });
  check(
    "有日期无时间仍追问时间",
    d2.data?.result?.missing.includes("time") && d2.data?.result?.events?.[0]?.date === todayStr(1),
    JSON.stringify(d2.data?.result)
  );
  const d3 = await api("/api/ai/parse", { method: "POST", body: { text: "晚上八点学习" } });
  check("有时间无日期仍追问日期", d3.data?.result?.missing.includes("date"), JSON.stringify(d3.data?.result));

  console.log("\n20) 截止日期提醒");
  const dl = await api("/api/ai/parse", { method: "POST", body: { text: "8月31号前完成实验报告" } });
  const devs = dl.data?.result?.events ?? [];
  check("截止任务生成4条提醒", devs.length === 4, JSON.stringify(devs));
  const D = shift("2026-08-31", -1); // "8月31号前" → 有效截止日 8.30
  check(
    "提醒日期为截止前7/3/1天和当天",
    devs[0]?.date === shift(D, -7) &&
      devs[1]?.date === shift(D, -3) &&
      devs[2]?.date === shift(D, -1) &&
      devs[3]?.date === D,
    JSON.stringify(devs.map((e) => e.date))
  );
  check(
    "提醒标题正确",
    devs[0]?.title === "距离实验报告还有七天" &&
      devs[1]?.title === "距离实验报告还有三天" &&
      devs[2]?.title === "距离实验报告还有一天" &&
      devs[3]?.title === "今天截止：实验报告",
    JSON.stringify(devs.map((e) => e.title))
  );
  check("全部为无时间待办", devs.every((e) => e.time === null));
  const dl2 = await api("/api/ai/parse", { method: "POST", body: { text: "8月31号前" } });
  check("截止任务缺标题时追问", dl2.data?.result?.missing.includes("title"), JSON.stringify(dl2.data?.result));
  const dl3 = await api("/api/ai/parse", { method: "POST", body: { text: "8月31日开会" } });
  check(
    "无'前'字仍是普通日期（追问时间）",
    dl3.data?.result?.missing.includes("time") && dl3.data?.result?.events?.[0]?.date === "2026-08-31",
    JSON.stringify(dl3.data?.result)
  );

  const dl4 = await api("/api/ai/parse", { method: "POST", body: { text: "八月三十一之前完成年度审核" } });
  const devs4 = dl4.data?.result?.events ?? [];
  check(
    "中文数字截止日期识别为4条提醒",
    devs4.length === 4 && devs4[0]?.title === "距离年度审核还有七天" && devs4[3]?.title === "今天截止：年度审核",
    JSON.stringify(devs4)
  );
  const dl5 = await api("/api/ai/parse", { method: "POST", body: { text: "九月一号之前交总结" } });
  const devs5 = dl5.data?.result?.events ?? [];
  check(
    "中文数字日期（含号）截止识别",
    devs5.length === 4 && devs5[3]?.date === "2026-08-31",
    JSON.stringify(devs5)
  );
  const dl6 = await api("/api/ai/parse", { method: "POST", body: { text: "八月三十一日开会" } });
  check(
    "中文数字日期普通日程（追问时间）",
    dl6.data?.result?.missing.includes("time") && dl6.data?.result?.events?.[0]?.date === "2026-08-31",
    JSON.stringify(dl6.data?.result)
  );

  console.log("\n21) 新建日程自动随机颜色");
  const rc = await api("/api/events", { method: "POST", body: { title: "随机色测试", date: todayStr(1), time: "09:00" } });
  const rcColor = rc.data?.event?.color;
  const allowed = ["red", "orange", "amber", "green", "blue", "purple", "pink"];
  check("未指定颜色时自动分配非灰色", typeof rcColor === "string" && allowed.includes(rcColor), JSON.stringify(rc.data));

  if (failures.length === 0) {
    console.log("\n🎉 全部通过");
  } else {
    console.log(`\n❌ 失败 ${failures.length} 项：${failures.join("、")}`);
  }
  // 等待网络句柄收尾，避免 Windows 上 process.exit 触发 libuv 断言
  await new Promise((r) => setTimeout(r, 300));
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
