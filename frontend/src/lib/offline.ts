// 简易离线缓存：把日程数据存到本地（localStorage），断网时读取缓存
// 说明：页面首次加载后断网可用；冷启动完全断网需要 HTTPS + Service Worker（待办项）
const PREFIX = "aical:cache:";

let cachedUserId: number | null = null;
let userIdPromise: Promise<number | null> | null = null;

async function getUserId(): Promise<number | null> {
  if (cachedUserId !== null) return cachedUserId;
  if (!userIdPromise) {
    userIdPromise = (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { user?: { id?: number } | null };
          cachedUserId = data.user?.id ?? null;
        }
      } catch {
        cachedUserId = null;
      }
      return cachedUserId;
    })();
  }
  return userIdPromise;
}

function storageKey(readKey: string): string {
  return PREFIX + (cachedUserId ?? "anon") + ":" + readKey;
}

/** 写入缓存（带用户隔离，防止同设备多账号串数据） */
export function cacheSet(readKey: string, value: unknown): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(storageKey(readKey), JSON.stringify(value));
  } catch {
    // 存储满或不可用时忽略
  }
}

/** 读取缓存，无缓存返回 null */
export function cacheGet(readKey: string): unknown | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(storageKey(readKey));
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

/**
 * 优先网络请求；离线或请求失败时回退本地缓存。
 * 返回 { data, fromCache }，调用方据此提示"离线模式"。
 */
export async function fetchCachedJson<T>(
  url: string
): Promise<{ data: T | null; fromCache: boolean }> {
  await getUserId();

  if (!isOnline()) {
    const cached = cacheGet(url) as T | null;
    if (cached !== null) return { data: cached, fromCache: true };
  }

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as T;
      cacheSet(url, data);
      return { data, fromCache: false };
    }
  } catch {
    // 网络失败，走缓存
  }

  const cached = cacheGet(url) as T | null;
  return cached !== null ? { data: cached, fromCache: true } : { data: null, fromCache: false };
}
