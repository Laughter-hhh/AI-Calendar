// 离线能力契约测试：验证安全的 Service Worker 应用壳和离线回退页已随部署包发布。
// 使用：先启动服务，然后 BASE_URL=http://localhost:3000 node scripts/offline-test.mjs
import { readFile } from "node:fs/promises";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const failures = [];

function check(name, condition, detail = "") {
  if (condition) console.log(`  ✅ ${name}`);
  else {
    failures.push(name);
    console.log(`  ❌ ${name} ${detail}`);
  }
}

async function main() {
  console.log(`离线能力检查：${BASE_URL}`);

  const [swSource, offlineSource, registrarSource, offlineClientSource] = await Promise.all([
    readFile(new URL("../frontend/public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../frontend/public/offline.html", import.meta.url), "utf8"),
    readFile(new URL("../frontend/src/components/OfflineRegistrar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../frontend/src/lib/offline.ts", import.meta.url), "utf8"),
  ]);
  check("Service Worker 注册入口存在", registrarSource.includes('register("/sw.js"'));
  check("Service Worker 提供离线回退页", swSource.includes('caches.match("/offline.html")'));
  check("Service Worker 缓存静态应用资源", swSource.includes("/_next/static/") && swSource.includes("manifest.webmanifest"));
  check("Service Worker 导航请求有超时回退", swSource.includes("AbortController") && swSource.includes("NAVIGATION_TIMEOUT_MS"));
  check("Service Worker 不缓存用户专属事件 API", !swSource.includes("api/events") && !swSource.includes("api/notes"));
  check("离线回退页包含重新连接入口", offlineSource.includes("当前处于离线状态") && offlineSource.includes('href="/"'));
  check("离线写入队列支持入队与联网重放", offlineClientSource.includes("enqueueMutation") && offlineClientSource.includes("flushMutationQueue"));
  check("离线队列按账号隔离", offlineClientSource.includes('const MUTATION_KEY = "__pending_mutations"') && offlineClientSource.includes("function storageKey") && offlineClientSource.includes("cacheGet(MUTATION_KEY)"));
  check("离线网络请求有超时且可重试", offlineClientSource.includes("AbortController") && offlineClientSource.includes("userIdPromise = null"));

  const [swResponse, offlineResponse] = await Promise.all([
    fetch(`${BASE_URL}/sw.js`, { cache: "no-store" }),
    fetch(`${BASE_URL}/offline.html`, { cache: "no-store" }),
  ]);
  const swText = await swResponse.text();
  const offlineText = await offlineResponse.text();
  check("线上 Service Worker 可访问", swResponse.status === 200 && swText.includes("SHELL_CACHE"), `status=${swResponse.status}`);
  check("线上离线回退页可访问", offlineResponse.status === 200 && offlineText.includes("当前处于离线状态"), `status=${offlineResponse.status}`);

  if (failures.length === 0) console.log("\n🎉 离线能力检查全部通过");
  else console.log(`\n❌ 失败 ${failures.length} 项：${failures.join("、")}`);
  // 让 fetch 的底层连接在 Windows 上有机会正常关闭，避免进程退出断言。
  await new Promise((resolve) => setTimeout(resolve, 300));
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
