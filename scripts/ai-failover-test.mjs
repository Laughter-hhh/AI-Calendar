// 验证主模型失败时按顺序切换备用端点，全部失败后回退本地规则。
import { OpenAICompatibleParser } from "../backend/ai/providers/openai.ts";
import { tryProviderChain } from "../backend/ai/provider-chain.ts";

const failures = [];
function check(name, condition) {
  if (condition) console.log(`  ✅ ${name}`);
  else {
    failures.push(name);
    console.log(`  ❌ ${name}`);
  }
}

const originalFetch = globalThis.fetch;

function successResponse(content) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

try {
  console.log("AI 服务故障转移测试：");

  let requestDetails;
  globalThis.fetch = async (url, options) => {
    requestDetails = { url: String(url), options, body: JSON.parse(options.body) };
    return successResponse("明天 15:00 开会");
  };
  const qwenParser = new OpenAICompatibleParser({
    OPENAI_API_KEY: "qwen-test-key",
    OPENAI_BASE_URL: "https://qwen.test/v1/",
    OPENAI_MODEL: "qwen-test-model",
    AI_PROVIDER_TIMEOUT_MS: "1500",
  }, "qwen");
  const canonical = await qwenParser.normalize("明天下午三点开会");
  check(
    "兼容端点发送正确 Base URL、模型和 Key",
    canonical === "明天 15:00 开会" &&
      requestDetails.url === "https://qwen.test/v1/chat/completions" &&
      requestDetails.body.model === "qwen-test-model" &&
      requestDetails.options.headers.Authorization === "Bearer qwen-test-key"
  );

  globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  });
  let timeoutMessage = "";
  try {
    await qwenParser.normalize("明天下午三点开会");
  } catch (error) {
    timeoutMessage = error instanceof Error ? error.message : "";
  }
  check("端点超时会被中止并报告可识别错误", timeoutMessage === "qwen 请求超时");

  let fallbackCalled = false;
  const primaryOnly = await tryProviderChain([
    { name: "openai", run: async () => "primary result" },
    { name: "qwen", run: async () => { fallbackCalled = true; return "fallback result"; } },
  ]);
  check("主服务正常时不调用备用服务", primaryOnly?.name === "openai" && !fallbackCalled);

  const qwenChain = await tryProviderChain([
    { name: "openai", run: async () => { throw new Error("simulated outage"); } },
    { name: "qwen", run: async () => "qwen result" },
  ]);
  check("主服务网络故障后由第一备用接管", qwenChain?.name === "qwen");

  const order = [];
  const glmChain = await tryProviderChain([
    { name: "openai", run: async () => { order.push("openai"); throw new Error("simulated outage"); } },
    { name: "qwen", run: async () => { order.push("qwen"); throw new Error("simulated outage"); } },
    { name: "glm", run: async () => { order.push("glm"); return "glm result"; } },
  ]);
  check("前两项服务失败后由第二备用接管", glmChain?.name === "glm" && order.join(",") === "openai,qwen,glm");

  const exhausted = await tryProviderChain([
    { name: "openai", run: async () => { throw new Error("simulated outage"); } },
    { name: "qwen", run: async () => { throw new Error("simulated outage"); } },
    { name: "glm", run: async () => { throw new Error("simulated outage"); } },
  ]);
  check("所有 API 故障后返回空值以触发本地解析兜底", exhausted === null);
} finally {
  globalThis.fetch = originalFetch;
}

if (failures.length) {
  console.error(`\n❌ 失败 ${failures.length} 项：${failures.join("、")}`);
  process.exitCode = 1;
} else {
  console.log("\n🎉 AI 故障转移测试全部通过");
}
