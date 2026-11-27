import { describe, expect, it } from "vitest";
import { seededDb } from "./support/db";
import { levelInfo, streak } from "../src/lib/domain/gamification";
import { creditBalance } from "../src/lib/domain/credits";

describe("demo seed", () => {
  const t0 = performance.now();
  const db = seededDb();
  const ms = performance.now() - t0;

  it("creates a coherent demo school", () => {
    const counts = Object.fromEntries(
      ["users", "grades", "attendance", "assignments", "submissions", "schedule_slots", "document_chunks", "quiz_attempts", "xp_transactions", "support_indicators"].map((t) => [
        t,
        db.get<{ c: number }>(`SELECT COUNT(*) c FROM ${t}`)!.c,
      ]),
    );
    console.log("seed ms", Math.round(ms), counts);
    expect(counts.users).toBe(36);
    expect(counts.schedule_slots).toBe(90);
    expect(counts.document_chunks).toBeGreaterThan(10);
  });

  it("gives Alex a 6-day streak, credits and a level", () => {
    const s = streak(db, "usr_alex");
    const lvl = levelInfo(db, "usr_alex");
    console.log("alex", s, lvl, "credits", creditBalance(db, "usr_alex"));
    expect(s.current).toBe(6);
    expect(s.activeToday).toBe(false);
    expect(s.best).toBe(6);
    expect(creditBalance(db, "usr_alex")).toBe(90); // 120 earned, minus a 30-credit mini-course
  });

  it("detects patterns for human review", () => {
    const rows = db.all<{ student_id: string; kind: string; strength: string; status: string }>(
      `SELECT student_id, kind, strength, status FROM support_indicators ORDER BY student_id`,
    );
    console.log(rows);
    expect(rows.some((r) => r.student_id === "usr_jordan" && r.kind === "grade_decline")).toBe(true);
    expect(rows.some((r) => r.student_id === "usr_noah" && r.kind === "engagement_drop")).toBe(true);
  });
});
