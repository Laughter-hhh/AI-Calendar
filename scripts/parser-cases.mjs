// 常用语句解析测试：覆盖日常表达，验证解析器稳定输出
// 使用：先启动服务，BASE_URL=... node scripts/parser-cases.mjs

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const failures = [];

function todayStr(offset = 0) {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function shift(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + 8 * 3600 * 1000);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

let cookie = "";
async function parse(text) {
  const res = await fetch(`${BASE_URL}/api/ai/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ text }),
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return res.json();
}

function check(name, cond, detail = "") {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures.push(name);
    console.log(`  ❌ ${name} ${detail}`);
  }
}

async function main() {
  const email = `cases-${Date.now()}@test.local`;
  const reg = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "123456" }),
  });
  const regSet = reg.headers.get("set-cookie");
  if (regSet) cookie = regSet.split(";")[0];

  console.log("常用语句解析测试：");

  let r = await parse("明天下午三点开会");
  check("明天下午三点开会 → 1条 15:00", r.result.events?.length === 1 && r.result.events[0].time === "15:00" && r.result.events[0].date === todayStr(1), JSON.stringify(r.result));

  r = await parse("今天上午十点开会");
  check("今天上午十点开会 → 10:00", r.result.events?.[0]?.time === "10:00" && r.result.events?.[0]?.date === todayStr(0), JSON.stringify(r.result));

  r = await parse("明天下午三点半接孩子");
  check("明天下午三点半接孩子 → 15:30", r.result.events?.[0]?.time === "15:30", JSON.stringify(r.result));

  r = await parse("从今天开始连续四天晚上八点学习 Python");
  check("连续四天 → 4条 20:00", r.result.events?.length === 4 && r.result.events.every((e) => e.time === "20:00"), JSON.stringify(r.result));

  r = await parse("每周一晚上八点健身");
  check("每周一 → weekly 20:00", r.result.events?.[0]?.repeat === "weekly" && r.result.events?.[0]?.time === "20:00", JSON.stringify(r.result));

  const D1 = shift("2026-08-31", -1);
  r = await parse("8月31号前完成实验报告");
  check("截止(阿拉伯数字) → 4条提醒", r.result.events?.length === 4 && r.result.events[0].title === "距离实验报告还有七天" && r.result.events[3].date === D1, JSON.stringify(r.result));
  check("截止提醒日期 7/3/1/当天", r.result.events?.[0]?.date === shift(D1, -7) && r.result.events?.[1]?.date === shift(D1, -3) && r.result.events?.[2]?.date === shift(D1, -1), JSON.stringify(r.result.events?.map((e) => e.date)));

  const D2 = shift("2026-08-31", -1);
  r = await parse("八月三十一之前完成年度审核");
  check("截止(中文数字) → 4条提醒、标题去动作词", r.result.events?.length === 4 && r.result.events[0].title === "距离年度审核还有七天" && r.result.events[3].title === "今天截止：年度审核", JSON.stringify(r.result));
  check("中文截止日期正确", r.result.events?.[3]?.date === D2 && r.result.events?.[0]?.date === shift(D2, -7), JSON.stringify(r.result.events?.map((e) => e.date)));

  r = await parse("九月一号之前交总结");
  check("中文数字含号截止 → 截止 8.31", r.result.events?.length === 4 && r.result.events[3].date === "2026-08-31", JSON.stringify(r.result));

  const sep1 = `${new Date(Date.now() + 8 * 3600 * 1000).getUTCFullYear()}-09-01`;
  r = await parse("九月一号领取美团骑行卡");
  check(
    "九月一号领取美团骑行卡 → 全天待办（不再追问）",
    r.result.events?.[0]?.date === sep1 &&
      r.result.events?.[0]?.title === "领取美团骑行卡" &&
      r.result.events?.[0]?.time === null &&
      r.result.missing?.length === 0 &&
      r.result.message?.includes("全天待办"),
    JSON.stringify(r.result)
  );

  const aug31 = `${new Date(Date.now() + 8 * 3600 * 1000).getUTCFullYear()}-08-31`;
  r = await parse("八月三十一完成年度审核");
  check(
    "八月三十一完成年度审核 → 8.31 全天待办（不误判截止）",
    r.result.events?.length === 1 &&
      r.result.events?.[0]?.date === aug31 &&
      r.result.events?.[0]?.time === null &&
      r.result.events?.[0]?.title === "年度审核" &&
      r.result.missing?.length === 0,
    JSON.stringify(r.result)
  );

  r = await parse("交报告");
  check("交报告 → 当天待办", r.result.events?.length === 1 && r.result.events[0].time === null && r.result.events[0].date === todayStr(0) && r.result.missing.length === 0, JSON.stringify(r.result));

  r = await parse("待办：明天交报告");
  check("待办：明天交报告 → 明天待办", r.result.events?.[0]?.time === null && r.result.events?.[0]?.date === todayStr(1), JSON.stringify(r.result));

  r = await parse("明天整理笔记无时间");
  check("明天整理笔记无时间 → 全天待办", r.result.events?.[0]?.time === null && r.result.events?.[0]?.date === todayStr(1), JSON.stringify(r.result));

  r = await parse("明天开会");
  check(
    "明天开会 → 全天待办",
    r.result.events?.[0]?.time === null && r.result.events?.[0]?.date === todayStr(1) && r.result.missing.length === 0,
    JSON.stringify(r.result)
  );

  r = await parse("晚上八点学习");
  check("晚上八点学习 → 追问日期", r.result.missing.includes("date"), JSON.stringify(r.result));

  r = await parse("八点半进行实验计划与果蝇收集");
  check("八点半进行… → 08:30 且标题干净", r.result.events?.[0]?.time === "08:30" && r.result.events?.[0]?.title === "实验计划与果蝇收集", JSON.stringify(r.result));

  if (failures.length === 0) {
    console.log("\n🎉 全部通过");
  } else {
    console.log(`\n❌ 失败 ${failures.length} 项：${failures.join("、")}`);
  }
  await new Promise((r) => setTimeout(r, 200));
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
