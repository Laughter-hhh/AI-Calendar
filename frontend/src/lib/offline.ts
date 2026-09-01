// 离线缓存：按账号把日程数据存到本地（localStorage），断网时读取缓存。
// Service Worker 负责静态应用壳和离线回退页；用户专属 API 不进入共享 Cache Storage。
const PREFIX = "aical:cache:";
const MUTATION_KEY = "__pending_mutations";
const ACTIVE_USER_KEY = "aical:active-user";
const USER_REQUEST_TIMEOUT_MS = 4000;
const API_REQUEST_TIMEOUT_MS = 8000;

export interface OfflineMutation {
  id: string;
  url: string;
  method: "POST" | "PATCH" | "DELETE";
  body?: unknown;
  createdAt: string;
}

let cachedUserId: number | null = null;
let userIdPromise: Promise<number | null> | null = null;

function readPersistedUserId(): number | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const value = Number(localStorage.getItem(ACTIVE_USER_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** 将当前登录账号记入本机，供完全离线重新打开应用时定位隔离缓存。 */
export function setOfflineUserId(userId: number): void {
  if (!Number.isInteger(userId) || userId <= 0) return;
  cachedUserId = userId;
  try {
    localStorage.setItem(ACTIVE_USER_KEY, String(userId));
  } catch {
    // 存储不可用时仍保留本次页面生命周期内的账号缓存。
  }
}

/** 登出时清除离线账号指针，避免下一位用户看到上一位用户的本地缓存。 */
export function clearOfflineUserId(): void {
  cachedUserId = null;
  userIdPromise = null;
  try {
    localStorage.removeItem(ACTIVE_USER_KEY);
  } catch {
    // 忽略不可用的本地存储。
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getUserId(): Promise<number | null> {
  if (cachedUserId === null) cachedUserId = readPersistedUserId();
  if (cachedUserId !== null) return cachedUserId;
  // 断网时不要为了识别账号发起网络请求；已有会话直接沿用持久化账号缓存。
  if (!isOnline()) return null;
  if (!userIdPromise) {
    userIdPromise = (async () => {
      try {
        const res = await fetchWithTimeout("/api/auth/me", { cache: "no-store" }, USER_REQUEST_TIMEOUT_MS);
        if (res.ok) {
          const data = (await res.json()) as { user?: { id?: number } | null };
          if (data.user?.id) setOfflineUserId(data.user.id);
          else cachedUserId = null;
        }
      } catch {
        cachedUserId = null;
      } finally {
        // 失败后允许下一次联网事件重新识别账号，避免离线期间的一次超时永久卡住队列。
        userIdPromise = null;
      }
      return cachedUserId;
    })();
  }
  return userIdPromise;
}

function storageKey(readKey: string): string {
  if (cachedUserId === null) cachedUserId = readPersistedUserId();
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

function readMutationQueue(): OfflineMutation[] {
  const value = cacheGet(MUTATION_KEY);
  return Array.isArray(value) ? (value as OfflineMutation[]) : [];
}

function writeMutationQueue(queue: OfflineMutation[]): void {
  cacheSet(MUTATION_KEY, queue);
}

/** 将需要联网提交的操作按账号暂存到本地，网络恢复后自动重放。 */
export function enqueueMutation(
  mutation: Omit<OfflineMutation, "id" | "createdAt">
): void {
  const queue = readMutationQueue();
  queue.push({
    ...mutation,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  });
  writeMutationQueue(queue);
}

/** 只在已识别当前登录账号且联网时重放队列，失败操作会保留等待下次重试。 */
export async function flushMutationQueue(): Promise<{ flushed: number; remaining: number }> {
  if (!isOnline()) return { flushed: 0, remaining: readMutationQueue().length };
  const queue = readMutationQueue();
  if (queue.length === 0) return { flushed: 0, remaining: 0 };
  const userId = await getUserId();
  if (userId === null) return { flushed: 0, remaining: queue.length };

  let flushed = 0;
  const remaining: OfflineMutation[] = [];
  for (const mutation of queue) {
    try {
      const response = await fetchWithTimeout(mutation.url, {
        method: mutation.method,
        headers: mutation.body === undefined ? undefined : { "Content-Type": "application/json" },
        body: mutation.body === undefined ? undefined : JSON.stringify(mutation.body),
      }, API_REQUEST_TIMEOUT_MS);
      if (response.ok) flushed += 1;
      else remaining.push(mutation);
    } catch {
      remaining.push(mutation);
    }
  }
  writeMutationQueue(remaining);
  if (flushed > 0 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("aical:offline-sync", { detail: { flushed } }));
  }
  return { flushed, remaining: remaining.length };
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
  if (!isOnline()) {
    const cached = cacheGet(url) as T | null;
    // 离线且没有对应视图缓存时立即返回，不要再等待一次网络超时。
    return cached !== null ? { data: cached, fromCache: true } : { data: null, fromCache: false };
  }

  await getUserId();

  try {
    const res = await fetchWithTimeout(url, { cache: "no-store" }, API_REQUEST_TIMEOUT_MS);
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
