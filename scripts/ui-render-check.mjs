// 页面渲染检查：验证"按日期查看日程"的服务端数据流
// 覆盖：注册 → 给"明天"创建日程 → ?date=明天 页面应显示该日程 → 今天页面不应显示
// 使用：先启动服务，然后 BASE_URL=http://localhost:3000 node scripts/ui-render-check.mjs

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const failures = [];

function todayStr(offset = 0) {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

let cookie = "";
async function api(path, { method = "GET", body } = {}) {
  const headers = { Accept: "text/html,application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(BASE_URL + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return { status: res.status, text };
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
  console.log(`页面渲染检查：${BASE_URL}`);

  const email = `ui-${Date.now()}@test.local`;
  const reg = await api("/api/auth/register", { method: "POST", body: { email, password: "123456" } });
  check("注册成功", reg.status === 200);

  const tomorrow = todayStr(1);
  const created = await api("/api/events", {
    method: "POST",
    body: { title: "界面测试日程", date: tomorrow, time: "09:30" },
  });
  check("为明天创建日程成功", created.status === 201);

  const datePage = await api(`/?date=${tomorrow}`);
  check("日期页返回 200", datePage.status === 200, `status=${datePage.status}`);
  check("日期页显示该日程标题", datePage.text.includes("界面测试日程"));
  check("日期页显示日期标题（如 明天/月日）", datePage.text.includes("的日程"));
  check("日期页包含日期切换控件", datePage.text.includes("前一段") && datePage.text.includes("后一段"));

  const weekPage = await api(`/?date=${tomorrow}&view=week`);
  check("周视图页面返回 200 且含未来7天标题", weekPage.status === 200 && weekPage.text.includes("未来 7 天"), `status=${weekPage.status}`);
  check("周视图页面显示该日程", weekPage.text.includes("界面测试日程"));

  const monthPage = await api(`/?date=${todayStr(0)}&view=month`);
  check(
    "月视图页面返回 200 且含月份标题与切换按钮",
    monthPage.status === 200 && monthPage.text.includes("年") && monthPage.text.includes("月") && monthPage.text.includes("上月"),
    `status=${monthPage.status}`
  );
  check("月视图页面显示该日程", monthPage.text.includes("界面测试日程"));

  const searchPage = await api(`/?date=${tomorrow}&q=界面`);
  check("搜索匹配时显示日程", searchPage.text.includes("界面测试日程"));
  const searchNone = await api(`/?date=${tomorrow}&q=完全不存在的词`);
  check("搜索无结果时显示提示", searchNone.text.includes("没有匹配的日程"));

  const todayPage = await api("/");
  check("今天页不显示明天的日程", !todayPage.text.includes("界面测试日程"));

  if (failures.length === 0) {
    console.log("\n🎉 页面渲染检查全部通过");
  } else {
    console.log(`\n❌ 失败 ${failures.length} 项：${failures.join("、")}`);
  }
  await new Promise((r) => setTimeout(r, 300));
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
