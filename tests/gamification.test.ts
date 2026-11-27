import { beforeEach, describe, expect, it } from "vitest";
import { actor, seededDb } from "./support/db";
import type { Db } from "../src/lib/db/client";
import {
  achievementsFor,
  claimQuest,
  grantXp,
  levelFor,
  logStudySession,
  questsFor,
  recordProgress,
  streak,
  STUDY_XP_DAILY_CAP,
  xpTotal,
} from "../src/lib/domain/gamification";
import { DomainError } from "../src/lib/auth/errors";

let db: Db;
beforeEach(() => {
  db = seededDb();
});

describe("XP ledger", () => {
  it("grants XP exactly once per idempotency key", () => {
    const before = xpTotal(db, "usr_alex");
    const e = { userId: "usr_alex", amount: 15, reason: "test", sourceType: "test", key: "test:once" };
    expect(grantXp(db, e)).toBe(15);
    expect(grantXp(db, e)).toBe(0);
    expect(xpTotal(db, "usr_alex")).toBe(before + 15);
  });

  it("never grants XP to non-students or non-positive amounts", () => {
    expect(grantXp(db, { userId: "usr_novak", amount: 10, reason: "x", sourceType: "t", key: "t:teacher" })).toBe(0);
    expect(grantXp(db, { userId: "usr_alex", amount: -50, reason: "x", sourceType: "t", key: "t:neg" })).toBe(0);
    expect(grantXp(db, { userId: "usr_alex", amount: 0, reason: "x", sourceType: "t", key: "t:zero" })).toBe(0);
  });

  it("is append-only at the database level", () => {
    expect(() => db.run(`UPDATE xp_transactions SET amount = 9999 WHERE user_id = 'usr_alex'`)).toThrow(/append-only/);
    expect(() => db.run(`DELETE FROM xp_transactions WHERE user_id = 'usr_alex'`)).toThrow(/append-only/);
    expect(() => db.run(`INSERT INTO xp_transactions (id, user_id, amount, reason, source_type, idempotency_key) VALUES ('x', 'usr_alex', -5, 'r', 's', 'k-neg')`)).toThrow();
  });

  it("maps XP to levels", () => {
    expect(levelFor(db, 0).level).toBe(1);
    expect(levelFor(db, 100).level).toBe(2);
    expect(levelFor(db, 1000).level).toBe(5);
    const l = levelFor(db, 1250);
    expect(l.level).toBe(5);
    expect(l.progress).toBeCloseTo(0.5, 5);
  });
});

describe("quests", () => {
  it("completes a quest from domain events and lets the student claim it once", () => {
    const alex = actor(db, "usr_alex");
    recordProgress(db, alex.id, "quiz_completed");
    const q = questsFor(db, alex.id, alex.schoolId).find((x) => x.id === "qst_daily_quiz")!;
    expect(q.completed_at).not.toBeNull();
    const before = xpTotal(db, alex.id);
    expect(claimQuest(db, alex, "qst_daily_quiz")).toBe(30);
    expect(xpTotal(db, alex.id)).toBeGreaterThanOrEqual(before + 30);
    expect(() => claimQuest(db, alex, "qst_daily_quiz")).toThrow(DomainError);
  });

  it("refuses to claim an incomplete quest", () => {
    expect(() => claimQuest(db, actor(db, "usr_alex"), "qst_daily_cards")).toThrow(/not complete/);
  });

  it("does not let teachers claim quests", () => {
    expect(() => claimQuest(db, actor(db, "usr_novak"), "qst_daily_quiz")).toThrow(DomainError);
  });
});

describe("streaks & achievements", () => {
  it("extends Alex's 6-day streak and unlocks the Seven-Day Streak achievement", () => {
    const alex = actor(db, "usr_alex");
    expect(streak(db, alex.id)).toMatchObject({ current: 6, activeToday: false });
    logStudySession(db, alex, 25, "Revision");
    expect(streak(db, alex.id)).toMatchObject({ current: 7, activeToday: true });
    const a = achievementsFor(db, alex.id).find((x) => x.code === "streak_7");
    expect(a?.earned_at).toBeTruthy();
  });

  it("caps study-time XP per day to avoid rewarding excessive screen time", () => {
    const alex = actor(db, "usr_alex");
    let total = 0;
    for (let i = 0; i < 6; i++) total += logStudySession(db, alex, 60, "Long session").xp;
    expect(total).toBe(STUDY_XP_DAILY_CAP);
  });

  it("validates study-session length", () => {
    expect(() => logStudySession(db, actor(db, "usr_alex"), 500, "x")).toThrow(DomainError);
  });
});
