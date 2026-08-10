// 认证模块：邮箱 + 密码（scrypt 加密）+ 服务端会话（Cookie）
// MVP 保持简单：不引入第三方依赖，用 Node 内置 crypto 实现
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getDb } from "./db";

export const SESSION_COOKIE = "ai_calendar_session";
const SESSION_DAYS = 30;

export interface User {
  id: number;
  email: string;
}

interface UserRow {
  id: number | bigint;
  email: string;
  password_hash: string;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

export function registerUser(
  email: string,
  password: string
): { ok: true; user: User } | { ok: false; error: string } {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(normalized);
  if (exists) return { ok: false, error: "该邮箱已注册，请直接登录" };

  const info = db
    .prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)")
    .run(normalized, hashPassword(password));
  return { ok: true, user: { id: Number(info.lastInsertRowid), email: normalized } };
}

export function loginUser(
  email: string,
  password: string
): { ok: true; user: User } | { ok: false; error: string } {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(normalized) as UserRow | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) {
    return { ok: false, error: "邮箱或密码不正确" };
  }
  return { ok: true, user: { id: Number(row.id), email: row.email } };
}

export function createSession(userId: number): string {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  getDb().prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expiresAt);
  return token;
}

export function getSessionUser(token: string | undefined): User | null {
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT u.id, u.email FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, new Date().toISOString()) as { id: number | bigint; email: string } | undefined;
  return row ? { id: Number(row.id), email: row.email } : null;
}

export function deleteSession(token: string): void {
  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export const SESSION_MAX_AGE = SESSION_DAYS * 86400;
