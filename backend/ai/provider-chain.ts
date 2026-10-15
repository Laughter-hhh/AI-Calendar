/** 依序尝试模型服务；null 表示该服务没有产出可用结果。 */
export async function tryProviderChain<T>(
  providers: Array<{ name: string; run: () => Promise<T | null> }>
): Promise<{ name: string; value: T } | null> {
  for (const provider of providers) {
    try {
      const value = await provider.run();
      if (value !== null) return { name: provider.name, value };
    } catch (error) {
      // 不记录请求正文或密钥；提供商错误只保留简短摘要。
      const message = error instanceof Error ? error.message : "未知错误";
      console.warn(`AI 提供商 ${provider.name} 失败，尝试下一服务：${message}`);
    }
  }
  return null;
}
