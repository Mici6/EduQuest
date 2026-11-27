import type { Actor } from "../auth/types";
import { notFound } from "../auth/errors";
import type { Db } from "../db/client";
import { json, newId } from "../db/client";
import { isoDate } from "../utils/dates";

export const NOTIFICATION_CATEGORIES = [
  { id: "academic", label: "Grades & homework", description: "New grades, homework deadlines and feedback." },
  { id: "announcement", label: "Announcements", description: "Messages from teachers and the school." },
  { id: "gamification", label: "Quests & XP", description: "Completed quests, level-ups and achievements." },
  { id: "rewards", label: "Credits", description: "Credits earned through verified volunteering." },
  { id: "volunteering", label: "Volunteering", description: "New opportunities and participation updates." },
  { id: "study", label: "Study suggestions", description: "Gentle revision recommendations." },
  { id: "system", label: "Account & security", description: "Important account notices (always on)." },
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]["id"];

/** Per-category daily caps keep low-value notifications from becoming spam. */
const DAILY_CAP: Partial<Record<NotificationCategory, number>> = { gamification: 4, study: 1, volunteering: 3 };

export type NotificationRow = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export type UserSettings = {
  notifications: Partial<Record<NotificationCategory, boolean>>;
  reduceMotion?: boolean;
  showOnLeaderboard?: boolean;
  dailyStudyGoalMinutes?: number;
  profileFrame?: string;
};

export function getUserSettings(db: Db, userId: string): UserSettings {
  const row = db.get<{ settings: string }>(`SELECT settings FROM user_settings WHERE user_id = ?`, userId);
  const s = json<UserSettings>(row?.settings, { notifications: {} });
  return {
    notifications: s.notifications ?? {},
    reduceMotion: !!s.reduceMotion,
    showOnLeaderboard: !!s.showOnLeaderboard,
    dailyStudyGoalMinutes: s.dailyStudyGoalMinutes ?? 30,
    profileFrame: s.profileFrame ?? "none",
  };
}

export function saveUserSettings(db: Db, actor: Actor, patch: Partial<UserSettings>) {
  const current = getUserSettings(db, actor.id);
  const next: UserSettings = {
    ...current,
    ...patch,
    notifications: { ...current.notifications, ...(patch.notifications ?? {}), system: true },
  };
  if (next.dailyStudyGoalMinutes != null) {
    next.dailyStudyGoalMinutes = Math.min(120, Math.max(10, Math.round(next.dailyStudyGoalMinutes)));
  }
  db.run(
    `INSERT INTO user_settings (user_id, settings) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET settings = excluded.settings`,
    actor.id,
    JSON.stringify(next),
  );
  return next;
}

/**
 * Create an in-app notification, honouring the user's category preferences,
 * de-duplication keys and per-category daily caps. Returns whether one was created.
 */
export function notify(
  db: Db,
  userId: string,
  n: { category: NotificationCategory; title: string; body: string; href?: string; dedupeKey?: string },
): boolean {
  if (n.category !== "system") {
    const prefs = getUserSettings(db, userId).notifications;
    if (prefs[n.category] === false) return false;
    const cap = DAILY_CAP[n.category];
    if (cap) {
      const today = isoDate();
      const count = db.get<{ c: number }>(
        `SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND category = ? AND date(created_at, 'localtime') = ?`,
        userId,
        n.category,
        today,
      )!.c;
      if (count >= cap) return false;
    }
  }
  const res = db.run(
    `INSERT INTO notifications (id, user_id, category, title, body, href, dedupe_key) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, dedupe_key) DO NOTHING`,
    newId("ntf_"),
    userId,
    n.category,
    n.title,
    n.body,
    n.href ?? null,
    n.dedupeKey ?? null,
  );
  return Number(res.changes) > 0;
}

export function listNotifications(db: Db, actor: Actor, opts: { category?: string; unreadOnly?: boolean; limit?: number } = {}) {
  const where = ["user_id = ?"];
  const params: string[] = [actor.id];
  if (opts.category && opts.category !== "all") {
    where.push("category = ?");
    params.push(opts.category);
  }
  if (opts.unreadOnly) where.push("read_at IS NULL");
  return db.all<NotificationRow>(
    `SELECT id, category, title, body, href, read_at, created_at FROM notifications WHERE ${where.join(" AND ")}
     ORDER BY created_at DESC LIMIT ${Math.min(opts.limit ?? 50, 200)}`,
    ...params,
  );
}

export function unreadCount(db: Db, actor: Actor): number {
  return db.get<{ c: number }>(`SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read_at IS NULL`, actor.id)!.c;
}

export function markRead(db: Db, actor: Actor, id: string, read = true) {
  const res = db.run(
    `UPDATE notifications SET read_at = ${read ? "datetime('now')" : "NULL"} WHERE id = ? AND user_id = ?`,
    id,
    actor.id,
  );
  if (Number(res.changes) === 0) throw notFound();
}

export function markAllRead(db: Db, actor: Actor) {
  db.run(`UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL`, actor.id);
}
