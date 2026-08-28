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
  check(
    "日期页包含紧凑切换与视图控件",
      datePage.text.includes("前一天") &&
      datePage.text.includes("后一天") &&
      datePage.text.includes("单日") &&
      datePage.text.includes("时间安排")
  );
  check("日程行包含完成勾选框", datePage.text.includes('type="checkbox"'));

  const weekPage = await api(`/?date=${tomorrow}&view=week`);
  check("时间安排页返回 200 且含标题与时间刻度", weekPage.status === 200 && weekPage.text.includes("时间安排") && weekPage.text.includes("6:00"), `status=${weekPage.status}`);
  check("周视图页面显示该日程", weekPage.text.includes("界面测试日程"));

  const monthPage = await api(`/?date=${todayStr(0)}&view=month`);
  check(
    "月视图页面返回 200 且含月份标题与切换按钮",
    monthPage.status === 200 && monthPage.text.includes("年") && monthPage.text.includes("月") && monthPage.text.includes("上月"),
    `status=${monthPage.status}`
  );
  check("月视图页面显示该日程", monthPage.text.includes("界面测试日程"));

  // 其他月份渲染：创建 10 月事件后，10 月月历应显示标题与该事件
  await api("/api/events", { method: "POST", body: { title: "十月测试", date: "2026-10-05", time: "09:00" } });
  const octPage = await api("/?date=2026-10-01&view=month");
  check("10月月历标题正确", octPage.status === 200 && octPage.text.includes("2026年10月"), `status=${octPage.status}`);
  check("10月月历显示该月事件", octPage.text.includes("十月测试"));

  const searchPage = await api(`/?date=${tomorrow}&q=界面`);
  check("搜索匹配时显示日程", searchPage.text.includes("界面测试日程"));
  const searchNone = await api(`/?date=${tomorrow}&q=完全不存在的词`);
  check("搜索无结果时显示提示", searchNone.text.includes("没有匹配的日程"));

  const todayPage = await api("/");
  check("今天页不显示明天的日程", !todayPage.text.includes("界面测试日程"));
  check("页面包含导入/导出按钮", todayPage.text.includes("导出") && todayPage.text.includes("导入"));
  await api("/api/events", { method: "POST", body: { title: "全天待办备忘", date: tomorrow } });
  const todoPage = await api(`/?date=${tomorrow}`);
  check("每日日程分为定时与待办两段", todoPage.text.includes("定时日程") && todoPage.text.includes("待办事项"));
  const downloadPage = await api("/download");
  check("下载页返回 200", downloadPage.status === 200, `status=${downloadPage.status}`);
  check("下载页包含下载按钮与 APK 链接", downloadPage.text.includes("下载 APK 安装包") && downloadPage.text.includes("/api/download/ai-calendar.apk"));
  check("下载页包含 iPhone 使用说明", downloadPage.text.includes("iPhone") && downloadPage.text.includes("添加到主屏幕"));
  check("首页包含苹果主屏幕图标与清单", todayPage.text.includes("apple-touch-icon") && todayPage.text.includes("manifest.webmanifest"));
  check("登录后页面包含设置入口与安全区", datePage.text.includes("设置") && datePage.text.includes("safe-area-inset-top"));
  const sharesPage = await api("/shares");
  check("共享页返回 200 且含共享表单", sharesPage.status === 200 && sharesPage.text.includes("共享我的日历"), `status=${sharesPage.status}`);
  const settingsPage = await api("/settings");
  check(
    "设置页返回 200 且含功能入口与版本",
    settingsPage.status === 200 &&
      settingsPage.text.includes("共享日历") &&
      settingsPage.text.includes("下载安卓 App") &&
      settingsPage.text.includes("版本"),
    `status=${settingsPage.status}`
  );

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
