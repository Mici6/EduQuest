import type { Actor } from "../auth/types";
import { assertCan } from "../auth/policy";
import { conflict, invalid, notFound } from "../auth/errors";
import type { Db } from "../db/client";
import { json, newId } from "../db/client";
import { audit } from "./audit";
import { COURSE_COMPLETION_XP, COURSES, courseById, gradeCourseQuiz } from "./course-catalog";
import { creditBalance } from "./credits";
import { issueCredential } from "./credentials";
import { grantXp } from "./gamification";
import { notify } from "./notifications";

/**
 * Mini-courses unlocked with credits. Each ends in a quiz; passing issues a
 * school-sealed certificate that appears in the Skills Passport.
 */

type Enrollment = { id: string; course_id: string; lessons_done: string; best_score: number | null; completed_at: string | null; certificate_id: string | null; unlocked_at: string };

function enrollment(db: Db, studentId: string, courseId: string) {
  return db.get<Enrollment>(`SELECT * FROM course_enrollments WHERE student_id = ? AND course_id = ?`, studentId, courseId);
}

const lessonsDone = (e: Enrollment | undefined) => new Set(json<number[]>(e?.lessons_done, []));

export function coursesFor(db: Db, actor: Actor) {
  assertCan(actor, "courses.unlock");
  const mine = new Map(db.all<Enrollment>(`SELECT * FROM course_enrollments WHERE student_id = ?`, actor.id).map((e) => [e.course_id, e]));
  return COURSES.map((c) => {
    const e = mine.get(c.id);
    return {
      id: c.id,
      title: c.title,
      summary: c.summary,
      icon: c.icon,
      creditCost: c.creditCost,
      minutes: c.minutes,
      skills: c.skills,
      lessons: c.lessons.length,
      status: !e ? ("locked" as const) : e.completed_at ? ("completed" as const) : ("unlocked" as const),
      lessonsDone: lessonsDone(e).size,
      bestScore: e?.best_score ?? null,
      certificateId: e?.certificate_id ?? null,
    };
  });
}

/** Course page data. Lesson text only after unlocking; quiz answers never leave the server. */
export function courseView(db: Db, actor: Actor, courseId: string) {
  assertCan(actor, "courses.unlock");
  const c = courseById(courseId);
  if (!c) throw notFound("Course not found.");
  const e = enrollment(db, actor.id, c.id);
  const done = lessonsDone(e);
  return {
    id: c.id,
    title: c.title,
    summary: c.summary,
    icon: c.icon,
    creditCost: c.creditCost,
    minutes: c.minutes,
    skills: c.skills,
    note: c.note ?? null,
    unlocked: !!e,
    completedAt: e?.completed_at ?? null,
    bestScore: e?.best_score ?? null,
    certificateId: e?.certificate_id ?? null,
    lessons: c.lessons.map((l, i) => ({ title: l.title, body: e ? l.body : null, done: done.has(i) })),
    quiz: e ? c.quiz.map((q) => ({ prompt: q.prompt, options: q.options })) : [],
    balance: creditBalance(db, actor.id),
  };
}

/** Spend credits to unlock a course. Idempotent: unlocking twice never charges twice. */
export function unlockCourse(db: Db, actor: Actor, courseId: string) {
  assertCan(actor, "courses.unlock");
  const c = courseById(courseId);
  if (!c) throw notFound("Course not found.");
  return db.tx(() => {
    if (enrollment(db, actor.id, c.id)) return { unlocked: true, charged: 0 };
    const balance = creditBalance(db, actor.id);
    if (balance < c.creditCost) throw conflict(`You need ${c.creditCost - balance} more credits to unlock this course.`);
    const txId = newId("crd_");
    db.run(
      `INSERT INTO credit_transactions (id, user_id, amount, kind, reason, source_type, source_id, idempotency_key, created_by)
       VALUES (?, ?, ?, 'redeem', ?, 'course_unlock', ?, ?, ?)`,
      txId,
      actor.id,
      -c.creditCost,
      `Mini-course: ${c.title}`,
      c.id,
      `course:${actor.id}:${c.id}`,
      actor.id,
    );
    db.run(`INSERT INTO course_enrollments (id, course_id, student_id, credit_tx_id) VALUES (?, ?, ?, ?)`, newId("enr_"), c.id, actor.id, txId);
    audit(db, actor.id, "course.unlock", "course", c.id, { cost: c.creditCost });
    return { unlocked: true, charged: c.creditCost };
  });
}

export function completeLesson(db: Db, actor: Actor, courseId: string, index: number) {
  assertCan(actor, "courses.unlock");
  const c = courseById(courseId);
  if (!c) throw notFound("Course not found.");
  if (!Number.isInteger(index) || index < 0 || index >= c.lessons.length) throw invalid("Unknown lesson.");
  const e = enrollment(db, actor.id, c.id);
  if (!e) throw conflict("Unlock this course first.");
  const done = lessonsDone(e);
  done.add(index);
  db.run(`UPDATE course_enrollments SET lessons_done = ? WHERE id = ?`, JSON.stringify([...done].sort((a, b) => a - b)), e.id);
  return done.size;
}

/** Grade the final quiz on the server. Passing completes the course and issues a sealed certificate. */
export function submitCourseQuiz(db: Db, actor: Actor, courseId: string, answers: string[], now = new Date()) {
  assertCan(actor, "courses.unlock");
  const c = courseById(courseId);
  if (!c) throw notFound("Course not found.");
  if (!Array.isArray(answers) || answers.length !== c.quiz.length) throw invalid("Answer every question first.");
  return db.tx(() => {
    const e = enrollment(db, actor.id, c.id);
    if (!e) throw conflict("Unlock this course first.");
    if (lessonsDone(e).size < c.lessons.length) throw conflict("Finish all lessons before the final quiz.");
    const result = gradeCourseQuiz(c, answers.map(String));
    db.run(`UPDATE course_enrollments SET best_score = MAX(COALESCE(best_score, 0), ?) WHERE id = ?`, result.pct, e.id);
    if (!result.passed || e.completed_at) return { ...result, certificateId: e.certificate_id };

    const student = db.get<{ display_name: string; school_name: string }>(
      `SELECT u.display_name, s.name school_name FROM users u JOIN schools s ON s.id = u.school_id WHERE u.id = ?`,
      actor.id,
    )!;
    const certificateId = issueCredential(
      db,
      {
        schoolId: actor.schoolId,
        studentId: actor.id,
        kind: "course_certificate",
        title: `Certificate of completion: ${c.title}`,
        payload: { studentName: student.display_name, schoolName: student.school_name, courseTitle: c.title, skills: c.skills, minutes: c.minutes, score: result.pct },
        issuedBy: null,
      },
      now,
    );
    db.run(`UPDATE course_enrollments SET completed_at = datetime('now'), certificate_id = ? WHERE id = ?`, certificateId, e.id);
    grantXp(db, { userId: actor.id, amount: COURSE_COMPLETION_XP, reason: `Course completed: ${c.title}`, sourceType: "course", sourceId: c.id, key: `course:${c.id}:${actor.id}` });
    notify(db, actor.id, {
      category: "gamification",
      title: `Certificate earned: ${c.title}`,
      body: "It's now in your Skills Passport.",
      href: "/app/passport",
      dedupeKey: `course_done:${c.id}`,
    });
    return { ...result, certificateId };
  });
}
