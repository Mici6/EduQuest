import { beforeEach, describe, expect, it } from "vitest";
import { actor, seededDb } from "./support/db";
import { Db, migrate } from "../src/lib/db/client";
import { simulatedProvider } from "../src/lib/ai/simulated";
import { COURSES, courseById, gradeCourseQuiz } from "../src/lib/domain/course-catalog";
import { completeLesson, courseView, coursesFor, submitCourseQuiz, unlockCourse } from "../src/lib/domain/courses";
import { creditBalance } from "../src/lib/domain/credits";
import { revokeCredential, verifyCredential } from "../src/lib/domain/credentials";
import {
  addProject,
  draftRecommendation,
  homeroomStudents,
  issuePassport,
  issueRecommendation,
  passportData,
  recommendationEligibility,
  verifyProject,
} from "../src/lib/domain/passport";
import { DomainError } from "../src/lib/auth/errors";

let db: Db;
beforeEach(() => {
  db = seededDb();
});

/** Give a student a known number of credits (as verified volunteering would). */
function grantCredits(userId: string, amount: number) {
  db.run(
    `INSERT INTO credit_transactions (id, user_id, amount, kind, reason, source_type, source_id, idempotency_key) VALUES (?, ?, ?, 'earn', 'test', 'volunteering', 'test', ?)`,
    `crd_test_${userId}`,
    userId,
    amount,
    `test:${userId}`,
  );
}

describe("mini-courses", () => {
  it("charges credits once, never twice, and hides lessons until unlocked", () => {
    const maya = actor(db, "usr_maya");
    const view = courseView(db, maya, "public-speaking");
    expect(view.unlocked).toBe(false);
    expect(view.lessons.every((l) => l.body === null)).toBe(true);
    expect(view.quiz).toEqual([]);
    grantCredits(maya.id, 100);
    const before = creditBalance(db, maya.id);
    expect(unlockCourse(db, maya, "public-speaking").charged).toBe(25);
    expect(unlockCourse(db, maya, "public-speaking").charged).toBe(0);
    expect(creditBalance(db, maya.id)).toBe(before - 25);
  });

  it("refuses to unlock without enough credits, and charges nothing", () => {
    db.run(`INSERT INTO users (id, school_id, role, display_name, email) VALUES ('usr_new', 'sch_demo', 'student', 'New Student', 'new@x')`);
    const s = actor(db, "usr_new");
    grantCredits(s.id, 40);
    unlockCourse(db, s, "programming-basics"); // 35 → 5 left
    expect(() => unlockCourse(db, s, "first-aid")).toThrow(/25 more credits/);
    expect(creditBalance(db, s.id)).toBe(5);
  });

  it("never sends quiz answers to the client", () => {
    const alex = actor(db, "usr_alex");
    const v = courseView(db, alex, "financial-education");
    expect(JSON.stringify(v.quiz)).not.toContain('"answer"');
  });

  it("grades on the server and issues a sealed, verifiable certificate on pass", () => {
    const alex = actor(db, "usr_alex");
    const c = courseById("first-aid")!;
    unlockCourse(db, alex, c.id);
    expect(() => submitCourseQuiz(db, alex, c.id, c.quiz.map((q) => q.answer))).toThrow(/lessons/);
    c.lessons.forEach((_, i) => completeLesson(db, alex, c.id, i));
    const fail = submitCourseQuiz(db, alex, c.id, c.quiz.map(() => "wrong"));
    expect(fail.passed).toBe(false);
    expect(fail.certificateId).toBeNull();
    const pass = submitCourseQuiz(db, alex, c.id, c.quiz.map((q) => q.answer));
    expect(pass.passed).toBe(true);
    const cert = verifyCredential(db, pass.certificateId!);
    expect(cert?.status).toBe("valid");
    expect(cert?.payload.courseTitle).toBe(c.title);
    expect(coursesFor(db, alex).find((x) => x.id === c.id)?.status).toBe("completed");
  });

  it("pass mark is 70%", () => {
    const c = COURSES[0]!;
    const answers = c.quiz.map((q, i) => (i < 4 ? q.answer : "x"));
    expect(gradeCourseQuiz(c, answers)).toMatchObject({ correct: 4, pct: 80, passed: true });
    expect(gradeCourseQuiz(c, answers.map((a, i) => (i < 3 ? a : "x"))).passed).toBe(false);
  });
});

describe("Skills Passport", () => {
  it("collects verified volunteering, badges, courses and projects (seed)", () => {
    const alex = actor(db, "usr_alex");
    const p = passportData(db, alex, alex.id);
    expect(p.volunteeringHours).toBeGreaterThan(0);
    expect(p.courses.map((c) => c.title)).toContain("Financial Education");
    expect(p.projects.some((x) => x.verified_at)).toBe(true);
    expect(p.projects.some((x) => !x.verified_at)).toBe(true);
  });

  it("students only see their own passport; support staff see none", () => {
    expect(() => passportData(db, actor(db, "usr_maya"), "usr_alex")).toThrow(DomainError);
    expect(() => passportData(db, actor(db, "usr_adeyemi"), "usr_alex")).toThrow(DomainError);
    expect(passportData(db, actor(db, "usr_okafor"), "usr_alex").student.name).toBe("Alex Rivera");
  });

  it("issues a sealed passport that detects tampering and revocation", () => {
    const alex = actor(db, "usr_alex");
    const id = issuePassport(db, alex);
    expect(verifyCredential(db, id)?.status).toBe("valid");
    db.run(`UPDATE credentials SET payload = replace(payload, 'Alex', 'Alexa') WHERE id = ?`, id);
    expect(verifyCredential(db, id)?.status).toBe("tampered");
    const id2 = issuePassport(db, alex);
    expect(() => revokeCredential(db, actor(db, "usr_maya"), id2)).toThrow(DomainError);
    revokeCredential(db, alex, id2);
    expect(verifyCredential(db, id2)?.status).toBe("revoked");
    expect(verifyCredential(db, "../../etc")).toBeNull();
  });

  it("validates projects and lets only the student's teachers verify them", () => {
    const alex = actor(db, "usr_alex");
    expect(() => addProject(db, alex, { title: "x", description: "too short" })).toThrow(DomainError);
    expect(() => addProject(db, alex, { title: "Robot", description: "A line-following robot.", link: "javascript:alert(1)" })).toThrow(DomainError);
    const id = addProject(db, alex, { title: "Robot", description: "A line-following robot.", link: "https://example.org/robot" });
    expect(() => verifyProject(db, actor(db, "usr_maya"), id, true)).toThrow(DomainError);
    verifyProject(db, actor(db, "usr_sato"), id, true);
    expect(passportData(db, alex, alex.id).projects.find((p) => p.id === id)?.verifier).toBe("Kenji Sato");
  });
});

describe("recommendation letters", () => {
  it("only the homeroom teacher can write one, after a year of activity", async () => {
    const novak = actor(db, "usr_novak");
    expect(recommendationEligibility(db, "usr_alex").eligible).toBe(true);
    expect(homeroomStudents(db, novak).some((s) => s.id === "usr_alex")).toBe(true);
    await expect(draftRecommendation(db, actor(db, "usr_okafor"), simulatedProvider, "usr_alex", "university", null)).rejects.toThrow(/homeroom/);

    const draft = await draftRecommendation(db, novak, simulatedProvider, "usr_alex", "scholarship", "Scholarship Committee");
    expect(draft.text).toContain("Alex Rivera");
    expect(draft.text).not.toContain("[Student]");

    db.run(`UPDATE users SET created_at = datetime('now', '-30 days') WHERE id = 'usr_alex'`);
    expect(() => issueRecommendation(db, novak, "usr_alex", { purpose: "university", recipient: null, body: draft.text })).toThrow(/one year/);
  });

  it("issues a signed letter that shows in the student's passport", async () => {
    const novak = actor(db, "usr_novak");
    const draft = await draftRecommendation(db, novak, simulatedProvider, "usr_alex", "university", null);
    expect(() => issueRecommendation(db, novak, "usr_alex", { purpose: "university", recipient: null, body: "too short" })).toThrow(DomainError);
    const id = issueRecommendation(db, novak, "usr_alex", { purpose: "university", recipient: null, body: draft.text });
    const v = verifyCredential(db, id)!;
    expect(v.status).toBe("valid");
    expect(v.issuerName).toBe("Elena Novak");
    expect(passportData(db, actor(db, "usr_alex"), "usr_alex").credentials.some((c) => c.id === id)).toBe(true);
    expect(() => revokeCredential(db, actor(db, "usr_alex"), id)).toThrow(DomainError);
    revokeCredential(db, novak, id);
    expect(verifyCredential(db, id)?.status).toBe("revoked");
  });
});

describe("v5 migration", () => {
  it("rebuilds an old credit ledger, keeping rows, so courses can be bought", () => {
    const db2 = new Db(":memory:");
    migrate(db2);
    db2.exec(`DROP TABLE course_enrollments;`);
    // Recreate the pre-v5 table (voucher-only debits) with one row.
    db2.exec(`DROP TRIGGER credits_no_update; DROP TRIGGER credits_no_delete; DROP TRIGGER credits_non_negative; DROP TRIGGER credits_no_vouchers; DROP TABLE credit_transactions;
      CREATE TABLE credit_transactions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), amount INTEGER NOT NULL CHECK (amount <> 0),
        kind TEXT NOT NULL CHECK (kind IN ('earn','redeem','refund')), reason TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK (source_type IN ('volunteering','voucher_redemption','redemption_refund')), source_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE, created_by TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now')),
        CHECK ((kind = 'redeem' AND amount < 0 AND source_type = 'voucher_redemption') OR (kind = 'earn' AND amount > 0 AND source_type = 'volunteering') OR (kind = 'refund' AND amount > 0 AND source_type = 'redemption_refund')));`);
    db2.run(`INSERT INTO schools (id, name) VALUES ('s', 'S')`);
    db2.run(`INSERT INTO users (id, school_id, role, display_name, email) VALUES ('u', 's', 'student', 'U', 'u@x')`);
    db2.run(`INSERT INTO credit_transactions (id, user_id, amount, kind, reason, source_type, source_id, idempotency_key) VALUES ('c1', 'u', 50, 'earn', 'r', 'volunteering', 'v', 'k1')`);
    migrate(db2);
    expect(db2.get<{ c: number }>(`SELECT COUNT(*) c FROM credit_transactions`)!.c).toBe(1);
    db2.run(`INSERT INTO credit_transactions (id, user_id, amount, kind, reason, source_type, source_id, idempotency_key) VALUES ('c2', 'u', -30, 'redeem', 'course', 'course_unlock', 'x', 'k2')`);
    expect(() => db2.run(`INSERT INTO credit_transactions (id, user_id, amount, kind, reason, source_type, source_id, idempotency_key) VALUES ('c3', 'u', -30, 'redeem', 'r', 'course_unlock', 'x', 'k3')`)).toThrow(/insufficient/);
    expect(() => db2.run(`UPDATE credit_transactions SET amount = 1 WHERE id = 'c1'`)).toThrow(/append-only/);
    expect(db2.all(`PRAGMA foreign_key_check`)).toEqual([]);
  });
});
