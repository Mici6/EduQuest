import { beforeEach, describe, expect, it } from "vitest";
import { actor, seededDb } from "./support/db";
import type { Db } from "../src/lib/db/client";
import { addGrade, attendanceFor, gradesFor, homeworkFor, recordAttendance } from "../src/lib/domain/catalog";
import { getDocument, listDocuments, processUpload } from "../src/lib/domain/documents";
import { getQuizForTaking, submitAttempt } from "../src/lib/domain/study";
import { indicatorDetail, planDetail, reviewIndicator, supportQueue } from "../src/lib/domain/support";
import { schoolOverview } from "../src/lib/domain/admin";
import { DomainError } from "../src/lib/auth/errors";
import { allowedRoles } from "../src/lib/auth/routes";
import { createSessionToken, verifySessionToken } from "../src/lib/auth/token";

let db: Db;
beforeEach(() => {
  db = seededDb();
});

const forbidden = (fn: () => unknown) => expect(fn).toThrow(DomainError);

describe("students", () => {
  it("can read only their own academic record", () => {
    const alex = actor(db, "usr_alex");
    expect(gradesFor(db, alex, alex.id).length).toBeGreaterThan(10);
    forbidden(() => gradesFor(db, alex, "usr_maya"));
    forbidden(() => attendanceFor(db, alex, "usr_maya"));
    forbidden(() => homeworkFor(db, alex, "usr_maya"));
  });

  it("cannot write grades or attendance, or open support records", () => {
    const alex = actor(db, "usr_alex");
    forbidden(() => addGrade(db, alex, { studentId: alex.id, classId: "cls_10a", subjectId: "sub_mat", value: 10, kind: "test", title: "Self-grade", gradedOn: "2026-01-01" }));
    forbidden(() => recordAttendance(db, alex, { classId: "cls_10a", subjectId: "sub_mat", date: "2026-01-01", entries: [] }));
    forbidden(() => supportQueue(db, alex));
    forbidden(() => planDetail(db, alex, "pln_lina"));
    forbidden(() => schoolOverview(db, alex));
  });

  it("never receive quiz answers before submitting", () => {
    const { questions } = getQuizForTaking(db, actor(db, "usr_alex"), "quiz_linear");
    for (const q of questions) {
      expect(q).not.toHaveProperty("answer");
      expect(q).not.toHaveProperty("explanation");
    }
  });

  it("cannot see another student's private uploads", async () => {
    const alex = actor(db, "usr_alex");
    const events = [];
    for await (const e of processUpload(db, alex, { fileName: "notes.txt", data: new TextEncoder().encode("My private revision notes about photosynthesis and chlorophyll in leaves. ".repeat(4)) }, {
      maxBytes: 1e6,
      store: async () => {},
      extract: async (_k, d) => ({ ok: true, text: new TextDecoder().decode(d), method: "utf-8" }),
    }))
      events.push(e);
    const id = events.at(-1)!.documentId!;
    expect(getDocument(db, alex, id).visibility).toBe("private");
    const maya = actor(db, "usr_maya");
    expect(listDocuments(db, maya).some((d) => d.id === id)).toBe(false);
    forbidden(() => getDocument(db, maya, id));
  });

  it("cannot access quizzes of other classes", () => {
    const lina = actor(db, "usr_lina"); // Class 10B — the seeded quizzes belong to 10A
    forbidden(() => getQuizForTaking(db, lina, "quiz_linear"));
    forbidden(() => submitAttempt(db, lina, "quiz_linear", {}));
  });
});

describe("teachers", () => {
  it("read records only for classes they teach", () => {
    const novak = actor(db, "usr_novak");
    expect(gradesFor(db, novak, "usr_alex").length).toBeGreaterThan(0);
    db.run(`INSERT INTO users (id, school_id, role, display_name, email) VALUES ('usr_newt', 'sch_demo', 'teacher', 'New Teacher', 'new.teacher@demo.eduquest.example')`);
    forbidden(() => gradesFor(db, actor(db, "usr_newt"), "usr_alex"));
  });

  it("cannot grade a class/subject they don't teach and validate input", () => {
    const novak = actor(db, "usr_novak");
    forbidden(() => addGrade(db, novak, { studentId: "usr_alex", classId: "cls_10a", subjectId: "sub_bio", value: 8, kind: "test", title: "Biology", gradedOn: "2026-11-01" }));
    expect(() => addGrade(db, novak, { studentId: "usr_alex", classId: "cls_10a", subjectId: "sub_mat", value: 11, kind: "test", title: "Too high", gradedOn: "2026-11-01" })).toThrow(/between 1 and 10/);
    expect(addGrade(db, novak, { studentId: "usr_alex", classId: "cls_10a", subjectId: "sub_mat", value: 9, kind: "test", title: "Equations", gradedOn: "2026-11-01" })).toMatch(/^grd_/);
  });

  it("have no access to student-support records", () => {
    const novak = actor(db, "usr_novak");
    forbidden(() => supportQueue(db, novak));
    forbidden(() => indicatorDetail(db, novak, "ind_lina_att"));
    forbidden(() => reviewIndicator(db, novak, "ind_lina_att", "dismissed", "Not my decision to make"));
  });
});

describe("support staff & administrators", () => {
  it("support staff only see students on their caseload", () => {
    const sam = actor(db, "usr_adeyemi");
    db.run(
      `INSERT INTO support_indicators (id, student_id, kind, strength, summary, evidence, detector, fingerprint) VALUES ('ind_leo', 'usr_leo', 'engagement_drop', 'low', 's', '[]', 'test', 'test:leo')`,
    );
    expect(supportQueue(db, sam).some((i) => i.id === "ind_leo")).toBe(false);
    forbidden(() => indicatorDetail(db, sam, "ind_leo"));
    expect(indicatorDetail(db, sam, "ind_lina_att").student.id).toBe("usr_lina");
  });

  it("administrators get aggregates but no individual support records", () => {
    const admin = actor(db, "usr_ionescu");
    expect(schoolOverview(db, admin).support.plans).toBeGreaterThanOrEqual(1);
    forbidden(() => indicatorDetail(db, admin, "ind_lina_att"));
    forbidden(() => planDetail(db, admin, "pln_lina"));
  });

  it("every support-record read is audit-logged", () => {
    const sam = actor(db, "usr_adeyemi");
    const before = db.get<{ c: number }>(`SELECT COUNT(*) c FROM audit_logs WHERE action = 'support.plan.view'`)!.c;
    planDetail(db, sam, "pln_lina");
    expect(db.get<{ c: number }>(`SELECT COUNT(*) c FROM audit_logs WHERE action = 'support.plan.view'`)!.c).toBe(before + 1);
  });
});

describe("sessions & routing", () => {
  it("rejects tampered or expired session tokens", () => {
    const t = createSessionToken("usr_alex", "student");
    expect(verifySessionToken(t)).toEqual({ uid: "usr_alex", role: "student" });
    const [p, s] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "usr_ionescu", role: "admin", exp: Date.now() + 1e6 })).toString("base64url");
    expect(verifySessionToken(`${forged}.${s}`)).toBeNull();
    expect(verifySessionToken(`${p}.${s}x`)).toBeNull();
    expect(verifySessionToken(createSessionToken("usr_alex", "student", Date.now() - 13 * 3600 * 1000))).toBeNull();
  });

  it("maps sections to roles", () => {
    expect(allowedRoles("/app/admin/people")).toEqual(["admin"]);
    expect(allowedRoles("/app/support/plans/x")).toEqual(["support"]);
    expect(allowedRoles("/app/quizzes/quiz_linear")).toEqual(["student", "teacher"]);
    expect(allowedRoles("/app/quizzes")).toEqual(["student"]);
    expect(allowedRoles("/app/settings")).toBeNull();
  });
});
