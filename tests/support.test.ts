import { beforeEach, describe, expect, it } from "vitest";
import { actor, seededDb } from "./support/db";
import type { Db } from "../src/lib/db/client";
import { addPlanNote, createPlan, planDetail, reviewIndicator, runDetection, setPlanStatus, supportQueue } from "../src/lib/domain/support";
import { creditBalance } from "../src/lib/domain/credits";
import { xpTotal } from "../src/lib/domain/gamification";
import { isoDate } from "../src/lib/utils/dates";

let db: Db;
beforeEach(() => {
  db = seededDb();
});

describe("student-support workflow", () => {
  it("detects the seeded patterns and is idempotent", () => {
    const sam = actor(db, "usr_adeyemi");
    const q = supportQueue(db, sam);
    expect(q.some((i) => i.student_id === "usr_jordan" && i.kind === "grade_decline" && i.status === "pending_review")).toBe(true);
    expect(runDetection(db, "sch_demo")).toBe(0);
  });

  it("detection never touches grades, XP or credits", () => {
    const snap = () => ({ xp: xpTotal(db, "usr_jordan"), credits: creditBalance(db, "usr_jordan"), grades: db.get<{ c: number }>(`SELECT COUNT(*) c FROM grades WHERE student_id = 'usr_jordan'`)!.c });
    const before = snap();
    db.run(`DELETE FROM support_indicators WHERE student_id = 'usr_jordan'`);
    runDetection(db, "sch_demo");
    expect(snap()).toEqual(before);
  });

  it("requires a human review with a rationale before a plan", () => {
    const sam = actor(db, "usr_adeyemi");
    const ind = supportQueue(db, sam).find((i) => i.student_id === "usr_jordan" && i.status === "pending_review")!;
    const review = isoDate(new Date(Date.now() + 14 * 86400000));
    expect(() => createPlan(db, sam, { studentId: "usr_jordan", indicatorId: ind.id, goals: "Catch up on maths", actions: "Weekly check-in with tutor", reviewOn: review })).toThrow(/Confirm the indicator/);
    expect(() => reviewIndicator(db, sam, ind.id, "confirmed", "ok")).toThrow(/rationale/);
    reviewIndicator(db, sam, ind.id, "confirmed", "Spoke with Jordan and the maths teacher; agreed extra support.");
    expect(() => reviewIndicator(db, sam, ind.id, "dismissed", "Changed my mind about this one")).toThrow(/already been reviewed/);
    const planId = createPlan(db, sam, { studentId: "usr_jordan", indicatorId: ind.id, goals: "Catch up on maths topics", actions: "Weekly check-in; catch-up worksheets", reviewOn: review });
    addPlanNote(db, sam, planId, "follow_up", "First check-in done.");
    const d = planDetail(db, sam, planId);
    expect(d.notes).toHaveLength(1);
    expect(d.plan.retain_until > isoDate()).toBe(true);
    setPlanStatus(db, sam, planId, "closed");
    expect(db.get<{ status: string }>(`SELECT status FROM support_indicators WHERE id = ?`, ind.id)!.status).toBe("resolved");
  });
});
