import type { Actor } from "../auth/types";
import { assertCan } from "../auth/policy";
import { conflict, notFound } from "../auth/errors";
import type { Db } from "../db/client";
import { newId } from "../db/client";
import { addDays, isoDate, parseIso, periodKey } from "../utils/dates";
import { notify } from "./notifications";

/**
 * XP is the progression currency. It can only be created by server-side
 * domain events (quiz completed, card reviewed, quest claimed…) and is
 * stored in an append-only ledger with idempotency keys, so the same event
 * can never be rewarded twice. XP is never spendable and never redeemable.
 */

export type QuestMetric =
  | "quiz_completed"
  | "flashcards_reviewed"
  | "study_minutes"
  | "assignment_submitted"
  | "volunteering_verified"
  | "ai_session";

export type LevelInfo = {
  level: number;
  title: string;
  xp: number;
  levelFloor: number;
  nextLevelXp: number | null;
  nextTitle: string | null;
  progress: number; // 0..1 within the current level
};

export function xpTotal(db: Db, userId: string): number {
  return db.get<{ s: number }>(`SELECT COALESCE(SUM(amount), 0) s FROM xp_transactions WHERE user_id = ?`, userId)!.s;
}

export function levelFor(db: Db, xp: number): LevelInfo {
  const levels = db.all<{ level: number; xp_required: number; title: string }>(`SELECT * FROM levels ORDER BY level`);
  let current = levels[0]!;
  let next: (typeof levels)[number] | undefined;
  for (let i = 0; i < levels.length; i++) {
    if (xp >= levels[i]!.xp_required) {
      current = levels[i]!;
      next = levels[i + 1];
    }
  }
  const span = next ? next.xp_required - current.xp_required : 1;
  return {
    level: current.level,
    title: current.title,
    xp,
    levelFloor: current.xp_required,
    nextLevelXp: next?.xp_required ?? null,
    nextTitle: next?.title ?? null,
    progress: next ? Math.min(1, (xp - current.xp_required) / span) : 1,
  };
}

export function levelInfo(db: Db, userId: string): LevelInfo {
  return levelFor(db, xpTotal(db, userId));
}

/**
 * Internal: grant XP for a verified domain event. Not reachable from any
 * client-callable action with a caller-supplied amount.
 * Returns the amount actually granted (0 if this event was already rewarded).
 */
export function grantXp(
  db: Db,
  e: { userId: string; amount: number; reason: string; sourceType: string; sourceId?: string; key: string },
): number {
  if (!Number.isInteger(e.amount) || e.amount <= 0) return 0;
  const role = db.get<{ role: string }>(`SELECT role FROM users WHERE id = ?`, e.userId)?.role;
  if (role !== "student") return 0;
  return db.tx(() => {
    const before = levelInfo(db, e.userId);
    const res = db.run(
      `INSERT INTO xp_transactions (id, user_id, amount, reason, source_type, source_id, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(idempotency_key) DO NOTHING`,
      newId("xp_"),
      e.userId,
      e.amount,
      e.reason,
      e.sourceType,
      e.sourceId ?? null,
      e.key,
    );
    if (Number(res.changes) === 0) return 0;
    const after = levelInfo(db, e.userId);
    if (after.level > before.level) {
      notify(db, e.userId, {
        category: "gamification",
        title: `Level ${after.level} reached — ${after.title}`,
        body: "Your consistent effort is paying off. New cosmetic themes unlocked in Progress.",
        href: "/app/progress",
        dedupeKey: `level:${after.level}`,
      });
    }
    return e.amount;
  });
}

export function xpHistory(db: Db, userId: string, limit = 30) {
  return db.all<{ id: string; amount: number; reason: string; source_type: string; created_at: string }>(
    `SELECT id, amount, reason, source_type, created_at FROM xp_transactions WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`,
    userId,
    limit,
  );
}

/** XP earned per day for the last `days` days (for charts). */
export function xpByDay(db: Db, userId: string, days = 14, today = new Date()) {
  const rows = db.all<{ day: string; xp: number }>(
    `SELECT date(created_at, 'localtime') day, SUM(amount) xp FROM xp_transactions WHERE user_id = ? GROUP BY day`,
    userId,
  );
  const map = new Map(rows.map((r) => [r.day, r.xp]));
  return Array.from({ length: days }, (_, i) => {
    const d = isoDate(addDays(today, i - days + 1));
    return { day: d, xp: map.get(d) ?? 0 };
  });
}

// ── Cosmetic unlocks ───────────────────────────────────────────────────────────

/** Purely cosmetic profile frames unlocked by level. They grant no advantage. */
export const PROFILE_FRAMES = [
  { id: "none", label: "No frame", level: 1 },
  { id: "sun", label: "Sunrise ring", level: 2 },
  { id: "ember", label: "Ember ring", level: 4 },
  { id: "iris", label: "Iris ring", level: 6 },
  { id: "aurora", label: "Aurora halo", level: 10 },
] as const;

export function frameUnlocked(frameId: string, level: number): boolean {
  const f = PROFILE_FRAMES.find((x) => x.id === frameId);
  return !!f && level >= f.level;
}

// ── Streaks ───────────────────────────────────────────────────────────────

/** Days on which the student did meaningful learning activity. */
export function activeDays(db: Db, userId: string): Set<string> {
  const rows = db.all<{ d: string }>(
    `SELECT date(completed_at, 'localtime') d FROM quiz_attempts WHERE student_id = ?
     UNION SELECT date(reviewed_at, 'localtime') FROM flashcard_progress WHERE user_id = ? AND reviewed_at IS NOT NULL
     UNION SELECT day FROM study_sessions WHERE user_id = ?
     UNION SELECT date(submitted_at, 'localtime') FROM submissions WHERE student_id = ?
     UNION SELECT date(created_at, 'localtime') FROM xp_transactions WHERE user_id = ?`,
    userId,
    userId,
    userId,
    userId,
    userId,
  );
  return new Set(rows.map((r) => r.d));
}

/**
 * Current streak: consecutive active days ending today, or ending yesterday
 * (a streak is not lost until a full day passes without activity).
 */
export function streak(db: Db, userId: string, today = new Date()): { current: number; best: number; activeToday: boolean } {
  const days = activeDays(db, userId);
  const activeToday = days.has(isoDate(today));
  let cursor = activeToday ? today : addDays(today, -1);
  let current = 0;
  while (days.has(isoDate(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const d of sorted) {
    const date = parseIso(d);
    run = prev && isoDate(addDays(prev, 1)) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = date;
  }
  return { current, best: Math.max(best, current), activeToday };
}

// ── Quests ─────────────────────────────────────────────────────────────────

export type QuestView = {
  id: string;
  cadence: "daily" | "weekly";
  metric: QuestMetric;
  title: string;
  description: string;
  target: number;
  xp_reward: number;
  difficulty: "easy" | "medium" | "hard";
  progress: number;
  completed_at: string | null;
  claimed_at: string | null;
  period_key: string;
};

export function questsFor(db: Db, userId: string, schoolId: string, now = new Date()): QuestView[] {
  const daily = periodKey("daily", now);
  const weekly = periodKey("weekly", now);
  return db.all<QuestView>(
    `SELECT q.id, q.cadence, q.metric, q.title, q.description, q.target, q.xp_reward, q.difficulty,
            COALESCE(p.progress, 0) progress, p.completed_at, p.claimed_at,
            CASE q.cadence WHEN 'daily' THEN ? ELSE ? END period_key
     FROM quests q
     LEFT JOIN quest_progress p ON p.quest_id = q.id AND p.user_id = ?
       AND p.period_key = CASE q.cadence WHEN 'daily' THEN ? ELSE ? END
     WHERE q.school_id = ? AND q.active = 1
     ORDER BY q.cadence, q.xp_reward`,
    daily,
    weekly,
    userId,
    daily,
    weekly,
    schoolId,
  );
}

/** Advance quest progress for a domain event. Called only by server code. */
export function recordProgress(db: Db, userId: string, metric: QuestMetric, amount = 1, now = new Date()) {
  const user = db.get<{ school_id: string; role: string }>(`SELECT school_id, role FROM users WHERE id = ?`, userId);
  if (!user || user.role !== "student") return;
  db.tx(() => {
    const quests = db.all<{ id: string; cadence: "daily" | "weekly"; target: number; title: string; xp_reward: number }>(
      `SELECT id, cadence, target, title, xp_reward FROM quests WHERE school_id = ? AND active = 1 AND metric = ?`,
      user.school_id,
      metric,
    );
    for (const q of quests) {
      const key = periodKey(q.cadence, now);
      db.run(
        `INSERT INTO quest_progress (user_id, quest_id, period_key, progress) VALUES (?, ?, ?, MIN(?, ?))
         ON CONFLICT(user_id, quest_id, period_key) DO UPDATE SET progress = MIN(progress + ?, ?)`,
        userId,
        q.id,
        key,
        amount,
        q.target,
        amount,
        q.target,
      );
      const row = db.get<{ progress: number; completed_at: string | null }>(
        `SELECT progress, completed_at FROM quest_progress WHERE user_id = ? AND quest_id = ? AND period_key = ?`,
        userId,
        q.id,
        key,
      )!;
      if (row.progress >= q.target && !row.completed_at) {
        db.run(
          `UPDATE quest_progress SET completed_at = datetime('now') WHERE user_id = ? AND quest_id = ? AND period_key = ?`,
          userId,
          q.id,
          key,
        );
        notify(db, userId, {
          category: "gamification",
          title: `Quest complete: ${q.title}`,
          body: `Claim your +${q.xp_reward} XP on the dashboard.`,
          href: "/app/dashboard#quests",
          dedupeKey: `quest:${q.id}:${key}`,
        });
      }
    }
  });
}

/** Student claims the XP of a completed quest for the current period. */
export function claimQuest(db: Db, actor: Actor, questId: string, now = new Date()): number {
  assertCan(actor, "gamification.earn");
  return db.tx(() => {
    const q = db.get<{ id: string; cadence: "daily" | "weekly"; xp_reward: number; title: string; school_id: string }>(
      `SELECT id, cadence, xp_reward, title, school_id FROM quests WHERE id = ? AND active = 1`,
      questId,
    );
    if (!q || q.school_id !== actor.schoolId) throw notFound("Quest not found.");
    const key = periodKey(q.cadence, now);
    const p = db.get<{ completed_at: string | null; claimed_at: string | null }>(
      `SELECT completed_at, claimed_at FROM quest_progress WHERE user_id = ? AND quest_id = ? AND period_key = ?`,
      actor.id,
      q.id,
      key,
    );
    if (!p?.completed_at) throw conflict("This quest is not complete yet.");
    if (p.claimed_at) throw conflict("You already claimed this quest.");
    db.run(
      `UPDATE quest_progress SET claimed_at = datetime('now') WHERE user_id = ? AND quest_id = ? AND period_key = ?`,
      actor.id,
      q.id,
      key,
    );
    const granted = grantXp(db, {
      userId: actor.id,
      amount: q.xp_reward,
      reason: `Quest: ${q.title}`,
      sourceType: "quest",
      sourceId: q.id,
      key: `quest:${q.id}:${key}:${actor.id}`,
    });
    evaluateAchievements(db, actor.id);
    return granted;
  });
}

// ── Achievements ─────────────────────────────────────────────────────────────

type AchievementCheck = (db: Db, userId: string) => boolean;

const count = (db: Db, sql: string, ...p: string[]) => db.get<{ c: number }>(sql, ...p)!.c;

export const ACHIEVEMENT_RULES: Record<string, AchievementCheck> = {
  first_quiz: (db, u) => count(db, `SELECT COUNT(*) c FROM quiz_attempts WHERE student_id = ?`, u) >= 1,
  perfect_score: (db, u) => count(db, `SELECT COUNT(*) c FROM quiz_attempts WHERE student_id = ? AND score = total AND total > 0`, u) >= 1,
  streak_7: (db, u) => streak(db, u).best >= 7,
  science_explorer: (db, u) =>
    count(
      db,
      `SELECT COUNT(DISTINCT qa.quiz_id) c FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id
       JOIN subjects s ON s.id = q.subject_id WHERE qa.student_id = ? AND s.short IN ('BIO','PHY','CHE')`,
      u,
    ) >= 3,
  bookworm: (db, u) => count(db, `SELECT COALESCE(SUM(correct + incorrect), 0) c FROM flashcard_progress WHERE user_id = ?`, u) >= 100,
  helpful_student: (db, u) => count(db, `SELECT COUNT(*) c FROM volunteering_registrations WHERE student_id = ? AND status = 'verified'`, u) >= 1,
  community_contributor: (db, u) =>
    count(db, `SELECT COUNT(*) c FROM volunteering_registrations WHERE student_id = ? AND status = 'verified'`, u) >= 3,
  math_master: (db, u) =>
    count(
      db,
      `SELECT COUNT(*) c FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id JOIN subjects s ON s.id = q.subject_id
       WHERE qa.student_id = ? AND s.short = 'MAT' AND qa.total > 0 AND qa.score * 1.0 / qa.total >= 0.8`,
      u,
    ) >= 3,
  homework_hero: (db, u) => count(db, `SELECT COUNT(*) c FROM submissions WHERE student_id = ?`, u) >= 5,
};

/** Award any newly satisfied achievements. Returns the codes awarded. */
export function evaluateAchievements(db: Db, userId: string): string[] {
  const owned = new Set(
    db
      .all<{ code: string }>(
        `SELECT a.code FROM student_achievements sa JOIN achievements a ON a.id = sa.achievement_id WHERE sa.user_id = ?`,
        userId,
      )
      .map((r) => r.code),
  );
  const all = db.all<{ id: string; code: string; title: string; xp_bonus: number }>(`SELECT id, code, title, xp_bonus FROM achievements`);
  const awarded: string[] = [];
  for (const a of all) {
    if (owned.has(a.code)) continue;
    const rule = ACHIEVEMENT_RULES[a.code];
    if (!rule || !rule(db, userId)) continue;
    db.run(`INSERT OR IGNORE INTO student_achievements (user_id, achievement_id) VALUES (?, ?)`, userId, a.id);
    awarded.push(a.code);
    if (a.xp_bonus > 0) {
      grantXp(db, { userId, amount: a.xp_bonus, reason: `Achievement: ${a.title}`, sourceType: "achievement", sourceId: a.id, key: `ach:${a.id}:${userId}` });
    }
    notify(db, userId, {
      category: "gamification",
      title: `Achievement unlocked: ${a.title}`,
      body: "See your collection in Progress.",
      href: "/app/progress#achievements",
      dedupeKey: `ach:${a.code}`,
    });
  }
  return awarded;
}

export function achievementsFor(db: Db, userId: string) {
  return db.all<{ id: string; code: string; title: string; description: string; icon: string; tier: string; xp_bonus: number; earned_at: string | null }>(
    `SELECT a.id, a.code, a.title, a.description, a.icon, a.tier, a.xp_bonus, sa.earned_at
     FROM achievements a LEFT JOIN student_achievements sa ON sa.achievement_id = a.id AND sa.user_id = ?
     ORDER BY sa.earned_at IS NULL, a.tier DESC, a.title`,
    userId,
  );
}

// ── Study sessions ─────────────────────────────────────────────────────────────

/**
 * Log focused study time. XP for study time is capped per day to avoid
 * rewarding excessive screen time.
 */
export const STUDY_XP_DAILY_CAP = 30;

export function logStudySession(db: Db, actor: Actor, minutes: number, activity: string, now = new Date()) {
  assertCan(actor, "gamification.earn");
  const m = Math.round(minutes);
  if (!Number.isFinite(m) || m < 5 || m > 120) throw conflict("Study sessions must be between 5 and 120 minutes.");
  const day = isoDate(now);
  return db.tx(() => {
    const id = newId("ses_");
    db.run(`INSERT INTO study_sessions (id, user_id, minutes, activity, day) VALUES (?, ?, ?, ?, ?)`, id, actor.id, m, activity.slice(0, 80), day);
    const earnedToday = db.get<{ s: number }>(
      `SELECT COALESCE(SUM(amount), 0) s FROM xp_transactions WHERE user_id = ? AND source_type = 'study_session' AND date(created_at, 'localtime') = ?`,
      actor.id,
      day,
    )!.s;
    const xp = Math.max(0, Math.min(Math.floor(m / 5) * 2, STUDY_XP_DAILY_CAP - earnedToday));
    const granted = xp > 0 ? grantXp(db, { userId: actor.id, amount: xp, reason: `Focused study (${m} min)`, sourceType: "study_session", sourceId: id, key: `study:${id}` }) : 0;
    recordProgress(db, actor.id, "study_minutes", m, now);
    evaluateAchievements(db, actor.id);
    return { xp: granted, capped: xp === 0 };
  });
}

export function studyMinutesToday(db: Db, userId: string, now = new Date()): number {
  return db.get<{ s: number }>(`SELECT COALESCE(SUM(minutes), 0) s FROM study_sessions WHERE user_id = ? AND day = ?`, userId, isoDate(now))!.s;
}

/** Opt-in, privacy-preserving leaderboard: XP only, first name + initial, opted-in students only. */
export function leaderboard(db: Db, schoolId: string, limit = 10) {
  return db
    .all<{ id: string; display_name: string; avatar_hue: number; xp: number; settings: string | null }>(
      `SELECT u.id, u.display_name, u.avatar_hue, COALESCE(SUM(x.amount), 0) xp, us.settings
       FROM users u LEFT JOIN xp_transactions x ON x.user_id = u.id
       LEFT JOIN user_settings us ON us.user_id = u.id
       WHERE u.school_id = ? AND u.role = 'student' AND u.active = 1
       GROUP BY u.id ORDER BY xp DESC`,
      schoolId,
    )
    .filter((r) => {
      try {
        return JSON.parse(r.settings ?? "{}").showOnLeaderboard === true;
      } catch {
        return false;
      }
    })
    .slice(0, limit)
    .map((r) => {
      const [first, last] = r.display_name.split(" ");
      return { id: r.id, name: `${first} ${last ? last[0] + "." : ""}`.trim(), avatarHue: r.avatar_hue, xp: r.xp };
    });
}
