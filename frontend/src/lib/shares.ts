// 日历共享数据访问层
import { getDb } from "./db";

export interface ShareInfo {
  userId: number;
  email: string;
  createdAt?: string;
}

export interface SharesState {
  sharedTo: ShareInfo[];
  sharedWithMe: ShareInfo[];
}

export function listShares(userId: number): SharesState {
  const db = getDb();
  const sharedTo = db
    .prepare(
      `SELECT u.id, u.email, s.created_at FROM calendar_shares s
       JOIN users u ON u.id = s.viewer_user_id
       WHERE s.owner_user_id = ?`
    )
    .all(userId) as unknown as Array<{ id: number | bigint; email: string; created_at: string }>;
  const sharedWithMe = db
    .prepare(
      `SELECT u.id, u.email FROM calendar_shares s
       JOIN users u ON u.id = s.owner_user_id
       WHERE s.viewer_user_id = ?`
    )
    .all(userId) as unknown as Array<{ id: number | bigint; email: string }>;

  return {
    sharedTo: sharedTo.map((r) => ({ userId: Number(r.id), email: r.email, createdAt: r.created_at })),
    sharedWithMe: sharedWithMe.map((r) => ({ userId: Number(r.id), email: r.email })),
  };
}

export function addShare(
  ownerUserId: number,
  email: string
): { ok: true; email: string } | { ok: false; error: string } {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const target = db.prepare("SELECT id FROM users WHERE email = ?").get(normalized) as
    | { id: number | bigint }
    | undefined;
  if (!target) return { ok: false, error: "该邮箱用户不存在" };
  if (Number(target.id) === ownerUserId) return { ok: false, error: "不能共享给自己" };
  db.prepare("INSERT OR IGNORE INTO calendar_shares (owner_user_id, viewer_user_id) VALUES (?, ?)").run(
    ownerUserId,
    Number(target.id)
  );
  return { ok: true, email: normalized };
}

export function removeShare(userId: number, email: string): { ok: boolean; error?: string } {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const target = db.prepare("SELECT id FROM users WHERE email = ?").get(normalized) as
    | { id: number | bigint }
    | undefined;
  if (!target) return { ok: false, error: "该邮箱用户不存在" };
  const targetId = Number(target.id);
  db.prepare(
    `DELETE FROM calendar_shares
     WHERE (owner_user_id = ? AND viewer_user_id = ?) OR (owner_user_id = ? AND viewer_user_id = ?)`
  ).run(userId, targetId, targetId, userId);
  return { ok: true };
}
