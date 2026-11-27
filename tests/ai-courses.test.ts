import { beforeEach, describe, expect, it } from "vitest";
import { actor, seededDb } from "./support/db";
import type { Db } from "../src/lib/db/client";
import { migrate } from "../src/lib/db/client";
import { simulatedProvider } from "../src/lib/ai/simulated";
import { cleanGeneratedCourse } from "../src/lib/ai/types";
import {
  accreditAiCourse,
  aiCourseView,
  completeAiLesson,
  courseReviewers,
  decideGrant,
  draftCourseLetter,
  GRANT_RULES,
  grantBudget,
  grantEligibility,
  maxGrant,
  requestAiCourse,
  reviewAiCourse,
  submitAiCourseQuiz,
} from "../src/lib/domain/ai-courses";
import { updateSchoolSettings } from "../src/lib/domain/admin";
import { verifyCredential } from "../src/lib/domain/credentials";
import { passportData } from "../src/lib/domain/passport";
import { DomainError } from "../src/lib/auth/errors";

let db: Db;
beforeEach(() => {
  db = seededDb();
});

const JUSTIFICATION =
  "The Red Cross first-aid certification exam costs 150 RON. Passing it turns this course into a recognised certificate I can use when volunteering at school events, and my family can't cover the fee this term.";

const request = (studentId: string, extra: { grantRequested?: number; grantPurpose?: string } = {}) =>
  requestAiCourse(db, actor(db, studentId), simulatedProvider, { topic: "Debate", reviewerId: "usr_novak", ...extra });

/** Approve, study, pass and accredit a course (no grant). */
async function finish(id: string) {
  const alex = actor(db, "usr_alex");
  const novak = actor(db, "usr_novak");
  if (aiCourseView(db, alex, id).status === "pending_review") reviewAiCourse(db, novak, id, { approve: true });
  aiCourseView(db, alex, id).lessons.forEach((_, i) => completeAiLesson(db, alex, id, i));
  const quiz = aiCourseView(db, novak, id).quiz as { answer: string }[];
  submitAiCourseQuiz(db, alex, id, quiz.map((q) => q.answer));
  const draft = await draftCourseLetter(db, novak, simulatedProvider, id);
  return accreditAiCourse(db, novak, id, draft.text);
}

describe("AI courses", () => {
  it("runs the whole flow: request → review → study → pass → accredited letter in the passport", async () => {
    const alex = actor(db, "usr_alex");
    const novak = actor(db, "usr_novak");
    expect(courseReviewers(db, alex.id).some((t) => t.id === novak.id)).toBe(true);

    const id = await request(alex.id);
    expect(aiCourseView(db, alex, id).lessons.every((l) => l.body === null)).toBe(true);
    expect(() => completeAiLesson(db, alex, id, 0)).toThrow(/approved/);
    reviewAiCourse(db, novak, id, { approve: true });

    const view = aiCourseView(db, alex, id);
    expect(JSON.stringify(view.quiz)).not.toContain('"answer"');
    expect(JSON.stringify(aiCourseView(db, novak, id).quiz)).toContain('"answer"');
    view.lessons.forEach((_, i) => completeAiLesson(db, alex, id, i));
    const quiz = aiCourseView(db, novak, id).quiz as { answer: string }[];
    expect(submitAiCourseQuiz(db, alex, id, quiz.map(() => "wrong")).passed).toBe(false);
    expect(submitAiCourseQuiz(db, alex, id, quiz.map((q) => q.answer)).passed).toBe(true);

    const draft = await draftCourseLetter(db, novak, simulatedProvider, id);
    expect(draft.text).toContain("Alex Rivera");
    expect(() => accreditAiCourse(db, novak, id, "too short")).toThrow(DomainError);
    const letterId = accreditAiCourse(db, novak, id, draft.text);
    const v = verifyCredential(db, letterId)!;
    expect(v.status).toBe("valid");
    expect(v.payload.purpose).toBe("course");
    expect(passportData(db, alex, alex.id).courses.some((c) => c.certificate_id === letterId)).toBe(true);
    expect(() => accreditAiCourse(db, novak, id, draft.text)).toThrow(/already/);
  });

  it("only the chosen reviewer can review; only the owner can study", async () => {
    const id = await request("usr_alex");
    expect(() => reviewAiCourse(db, actor(db, "usr_okafor"), id, { approve: true })).toThrow(DomainError);
    expect(() => aiCourseView(db, actor(db, "usr_maya"), id)).toThrow(DomainError);
    expect(() => reviewAiCourse(db, actor(db, "usr_novak"), id, { approve: false })).toThrow(/why/);
    reviewAiCourse(db, actor(db, "usr_novak"), id, { approve: false, note: "Please pick a narrower topic." });
    expect(aiCourseView(db, actor(db, "usr_alex"), id).status).toBe("rejected");
  });

  it("validates requests", async () => {
    const alex = actor(db, "usr_alex");
    await expect(requestAiCourse(db, alex, simulatedProvider, { topic: "x", reviewerId: "usr_novak" })).rejects.toThrow(/topic/);
    await expect(requestAiCourse(db, alex, simulatedProvider, { topic: "Debate", reviewerId: "usr_ionescu" })).rejects.toThrow(/teachers/);
  });

  it("drops broken AI output", () => {
    const base = { title: "T", summary: "S", skills: ["a"], lessons: [{ title: "L1", body: "x".repeat(100) }, { title: "L2", body: "y".repeat(100) }] };
    const good = { prompt: "Q", options: ["a", "b"], answer: "a" };
    expect(() => cleanGeneratedCourse({ ...base, quiz: [good, good, { ...good, answer: "zzz" }] })).toThrow();
    expect(cleanGeneratedCourse({ ...base, quiz: [good, good, good] }).quiz).toHaveLength(3);
  });
});

describe("grants are hard to get", () => {
  it("are locked until the student has an accredited course (and enough volunteering)", async () => {
    const g = grantEligibility(db, "usr_alex", "sch_demo");
    expect(g.eligible).toBe(false);
    expect(g.reasons.join(" ")).toMatch(/accredited/);
    await expect(request("usr_alex", { grantRequested: 100, grantPurpose: JUSTIFICATION })).rejects.toThrow(/accredited/);

    await finish(await request("usr_alex"));
    expect(grantEligibility(db, "usr_alex", "sch_demo").eligible).toBe(true);
    // A student with no verified volunteering still can't ask.
    expect(grantEligibility(db, "usr_maya", "sch_demo").reasons.join(" ")).toMatch(/volunteering|accredited/);
  });

  it("caps the amount and demands a real justification", async () => {
    await finish(await request("usr_alex"));
    expect(maxGrant(db, "sch_demo")).toBe(Math.min(GRANT_RULES.maxAmount, 5000 * GRANT_RULES.maxBudgetShare));
    await expect(request("usr_alex", { grantRequested: 501, grantPurpose: JUSTIFICATION })).rejects.toThrow(/at most/);
    await expect(request("usr_alex", { grantRequested: 100, grantPurpose: "Exam fee." })).rejects.toThrow(/150 characters/);
    updateSchoolSettings(db, actor(db, "usr_ionescu"), { grantBudget: 1000 });
    expect(maxGrant(db, "sch_demo")).toBe(100); // 10% of the budget
  });

  it("needs a teacher recommendation and an admin decision; money is reserved only on approval and paid on accreditation", async () => {
    const alex = actor(db, "usr_alex");
    const novak = actor(db, "usr_novak");
    const admin = actor(db, "usr_ionescu");
    await finish(await request(alex.id));
    const before = grantBudget(db, alex.schoolId).remaining;

    const id = await request(alex.id, { grantRequested: 300, grantPurpose: JUSTIFICATION });
    await expect(request(alex.id, { grantRequested: 50, grantPurpose: JUSTIFICATION })).rejects.toThrow(/being decided/);
    expect(() => reviewAiCourse(db, novak, id, { approve: true, grant: 400 })).toThrow(/at most/);
    reviewAiCourse(db, novak, id, { approve: true, grant: 200 });
    expect(aiCourseView(db, alex, id).grant.status).toBe("recommended");
    expect(grantBudget(db, alex.schoolId).remaining).toBe(before); // nothing reserved yet

    expect(() => decideGrant(db, novak, id, { approve: true, amount: 200 })).toThrow(DomainError); // teachers can't decide
    expect(() => decideGrant(db, admin, id, { approve: true, amount: 250 })).toThrow(/between 1 and 200/);
    decideGrant(db, admin, id, { approve: true, amount: 150 });
    expect(aiCourseView(db, alex, id).grant).toMatchObject({ status: "approved", approved: 150 });
    expect(grantBudget(db, alex.schoolId).remaining).toBe(before - 150);
    expect(() => decideGrant(db, admin, id, { approve: true, amount: 150 })).toThrow(/isn't waiting/);

    await finish(id);
    expect(aiCourseView(db, alex, id).grant.status).toBe("released");
    // One grant per year.
    expect(grantEligibility(db, alex.id, alex.schoolId).reasons.join(" ")).toMatch(/one grant per year/i);
  });

  it("teacher can decline by recommending 0; admin must give a reason to decline", async () => {
    await finish(await request("usr_alex"));
    const a = await request("usr_alex", { grantRequested: 100, grantPurpose: JUSTIFICATION });
    reviewAiCourse(db, actor(db, "usr_novak"), a, { approve: true, grant: 0 });
    expect(aiCourseView(db, actor(db, "usr_alex"), a).grant.status).toBe("declined");

    const b = await request("usr_alex", { grantRequested: 100, grantPurpose: JUSTIFICATION });
    reviewAiCourse(db, actor(db, "usr_novak"), b, { approve: true, grant: 100 });
    expect(() => decideGrant(db, actor(db, "usr_ionescu"), b, { approve: false })).toThrow(/reason/);
    decideGrant(db, actor(db, "usr_ionescu"), b, { approve: false, note: "The exam is free for students this year." });
    expect(aiCourseView(db, actor(db, "usr_alex"), b).grant).toMatchObject({ status: "declined", approved: 0 });
  });

  it("upgrades older databases: existing approved grants keep counting against the budget", () => {
    // Rebuild ai_courses in its pre-v8 shape (no grant workflow columns), with one approved grant.
    db.exec(`PRAGMA foreign_keys = OFF;
      CREATE TABLE old AS SELECT id, school_id, student_id, reviewer_id, topic, title, summary, skills, lessons, quiz, status, review_note, grant_purpose,
        grant_requested, grant_approved, lessons_done, best_score, letter_id, created_at, reviewed_at, completed_at, accredited_at FROM ai_courses;
      DROP TABLE ai_courses; ALTER TABLE old RENAME TO ai_courses; PRAGMA foreign_keys = ON;`);
    db.run(`UPDATE ai_courses SET status = 'approved', grant_requested = 150, grant_approved = 150, reviewed_at = datetime('now') WHERE id = 'aic_alex_debate'`);
    migrate(db);
    expect(aiCourseView(db, actor(db, "usr_alex"), "aic_alex_debate").grant.status).toBe("approved");
    expect(grantBudget(db, "sch_demo").committed).toBe(150);
    migrate(db); // idempotent

  });
});
