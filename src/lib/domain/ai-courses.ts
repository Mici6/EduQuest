import type { Actor } from "../auth/types";
import { assertAcademicRecord, studentClassIds } from "../auth/policy";
import { conflict, forbidden, invalid, notFound } from "../auth/errors";
import type { AiProvider, GeneratedCourse } from "../ai/types";
import type { Db } from "../db/client";
import { json, newId } from "../db/client";
import { schoolSettings } from "./admin";
import { audit } from "./audit";
import { COURSE_COMPLETION_XP, COURSE_PASS_PCT } from "./course-catalog";
import { issueCredential } from "./credentials";
import { grantXp } from "./gamification";
import { notify } from "./notifications";
import { studentFacts } from "./passport";

/**
 * AI-generated courses. A student asks for a course on any topic (first aid,
 * debate…), and, if they qualify, a grant from the school's budget (see
 * GRANT_RULES). A teacher of theirs reviews the AI's draft and approves it,
 * the student studies it and passes the quiz, and that same teacher accredits
 * it by signing a letter of recommendation.
 */

export type AiCourseStatus = "pending_review" | "approved" | "rejected" | "completed" | "accredited";
export type GrantStatus = "none" | "requested" | "recommended" | "declined" | "approved" | "released";

type Row = {
  id: string;
  school_id: string;
  student_id: string;
  reviewer_id: string;
  topic: string;
  title: string;
  summary: string;
  skills: string;
  lessons: string;
  quiz: string;
  status: AiCourseStatus;
  review_note: string | null;
  grant_purpose: string | null;
  grant_requested: number;
  grant_approved: number;
  grant_status: GrantStatus;
  grant_recommended: number;
  grant_note: string | null;
  grant_decided_by: string | null;
  grant_decided_at: string | null;
  lessons_done: string;
  best_score: number | null;
  letter_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  completed_at: string | null;
  accredited_at: string | null;
};

const MAX_OPEN_REQUESTS = 3;
const STUDYING: AiCourseStatus[] = ["approved", "completed", "accredited"];

function row(db: Db, id: string) {
  const r = db.get<Row>(`SELECT * FROM ai_courses WHERE id = ?`, id);
  if (!r) throw notFound("Course not found.");
  return r;
}

const content = (r: Row) => ({
  skills: json<string[]>(r.skills, []),
  lessons: json<GeneratedCourse["lessons"]>(r.lessons, []),
  quiz: json<GeneratedCourse["quiz"]>(r.quiz, []),
  done: new Set(json<number[]>(r.lessons_done, [])),
});

// ── Grants budget ────────────────────────────────────────────────────────────

/**
 * Grants are deliberately hard to get. A student may only ask after proving
 * commitment, amounts are capped, the justification must be detailed, two
 * people must say yes (the reviewing teacher recommends, an administrator
 * decides), and the money is only released once the course is accredited.
 */
export const GRANT_RULES = {
  minAccreditedCourses: 1,
  minVolunteeringHours: 5,
  cooldownDays: 365,
  maxAmount: 500,
  maxBudgetShare: 0.1,
  minJustification: 150,
} as const;

/** The school's grant budget; approved (reserved) and released grants both count against it. */
export function grantBudget(db: Db, schoolId: string) {
  const s = schoolSettings(db, schoolId);
  const committed = db.get<{ n: number }>(`SELECT COALESCE(SUM(grant_approved), 0) n FROM ai_courses WHERE school_id = ? AND grant_status IN ('approved','released')`, schoolId)!.n;
  return { budget: s.grantBudget, currency: s.grantCurrency, committed, remaining: Math.max(0, s.grantBudget - committed) };
}

/** Largest single grant: the fixed cap, a share of the total budget, or what's left, whichever is lowest. */
export function maxGrant(db: Db, schoolId: string) {
  const b = grantBudget(db, schoolId);
  return Math.max(0, Math.min(GRANT_RULES.maxAmount, Math.floor(b.budget * GRANT_RULES.maxBudgetShare), b.remaining));
}

/** Can this student ask for a grant right now? Lists every unmet condition. */
export function grantEligibility(db: Db, studentId: string, schoolId: string, now = new Date()) {
  const accredited = db.get<{ c: number }>(`SELECT COUNT(*) c FROM ai_courses WHERE student_id = ? AND status = 'accredited'`, studentId)!.c;
  const minutes = db.get<{ m: number }>(
    `SELECT COALESCE(SUM(a.duration_minutes), 0) m FROM volunteering_registrations r JOIN volunteering_activities a ON a.id = r.activity_id WHERE r.student_id = ? AND r.status = 'verified'`,
    studentId,
  )!.m;
  const hours = Math.round(minutes / 6) / 10;
  const open = db.get<{ c: number }>(`SELECT COUNT(*) c FROM ai_courses WHERE student_id = ? AND grant_status IN ('requested','recommended')`, studentId)!.c;
  const last = db.get<{ at: string | null }>(`SELECT MAX(grant_decided_at) at FROM ai_courses WHERE student_id = ? AND grant_status IN ('approved','released')`, studentId)!.at;
  const daysSince = last ? Math.floor((now.getTime() - new Date(last.replace(" ", "T") + "Z").getTime()) / 86_400_000) : null;
  const max = maxGrant(db, schoolId);
  const reasons: string[] = [];
  if (accredited < GRANT_RULES.minAccreditedCourses) reasons.push("Finish at least one AI course and get it accredited by a teacher first.");
  if (hours < GRANT_RULES.minVolunteeringHours) reasons.push(`Complete at least ${GRANT_RULES.minVolunteeringHours} hours of verified volunteering (you have ${hours}).`);
  if (open > 0) reasons.push("You already have a grant request being decided.");
  if (daysSince != null && daysSince < GRANT_RULES.cooldownDays) reasons.push(`Only one grant per year: you can ask again in ${GRANT_RULES.cooldownDays - daysSince} days.`);
  if (max <= 0) reasons.push("Your school's grant budget is used up.");
  return { eligible: reasons.length === 0, reasons, maxAmount: max, accredited, hours };
}

export type GrantRow = {
  id: string;
  title: string;
  grant_purpose: string | null;
  grant_requested: number;
  grant_recommended: number;
  grant_approved: number;
  grant_status: GrantStatus;
  grant_note: string | null;
  grant_decided_at: string | null;
  student: string;
  reviewer: string;
};

/** Admin view: budget, grants waiting for a final decision, and the history. */
export function grantsOverview(db: Db, actor: Actor) {
  if (actor.role !== "admin") throw forbidden();
  const grants = db.all<GrantRow>(
    `SELECT c.id, c.title, c.grant_purpose, c.grant_requested, c.grant_recommended, c.grant_approved, c.grant_status, c.grant_note, c.grant_decided_at,
            s.display_name student, t.display_name reviewer
     FROM ai_courses c JOIN users s ON s.id = c.student_id JOIN users t ON t.id = c.reviewer_id
     WHERE c.school_id = ? AND c.grant_status <> 'none'
     ORDER BY CASE c.grant_status WHEN 'recommended' THEN 0 WHEN 'requested' THEN 1 ELSE 2 END, c.created_at DESC`,
    actor.schoolId,
  );
  return { ...grantBudget(db, actor.schoolId), maxGrant: maxGrant(db, actor.schoolId), grants };
}

/** Final decision by an administrator. Only now is money reserved from the budget. */
export function decideGrant(db: Db, actor: Actor, id: string, input: { approve: boolean; amount?: number; note?: string | null }) {
  if (actor.role !== "admin") throw forbidden();
  return db.tx(() => {
    const r = row(db, id);
    if (r.school_id !== actor.schoolId) throw notFound("Grant not found.");
    if (r.grant_status !== "recommended") throw conflict("This grant isn't waiting for a decision.");
    const note = input.note?.trim().slice(0, 500) || null;
    const b = grantBudget(db, r.school_id);
    let amount = 0;
    if (input.approve) {
      amount = Math.round(Number(input.amount) || 0);
      const max = Math.min(r.grant_recommended, maxGrant(db, r.school_id));
      if (amount < 1 || amount > max) throw invalid(`Approve between 1 and ${max} ${b.currency} (the teacher's recommendation, the per-grant cap and what's left in the budget).`);
    } else if (!note) throw invalid("Give the student a reason for declining the grant.");
    db.run(
      `UPDATE ai_courses SET grant_status = ?, grant_approved = ?, grant_note = ?, grant_decided_by = ?, grant_decided_at = datetime('now') WHERE id = ?`,
      // Decided after the course was already accredited: release straight away.
      input.approve ? (r.status === "accredited" ? "released" : "approved") : "declined",
      amount,
      note,
      actor.id,
      r.id,
    );
    notify(db, r.student_id, {
      category: "academic",
      title: input.approve ? `Grant approved: ${amount} ${b.currency}` : "Grant declined",
      body: input.approve
        ? `Your grant for “${r.title}” is reserved. It is released when your teacher accredits the course.`
        : `Your grant request for “${r.title}” was declined: ${note}`,
      href: `/app/courses/ai/${r.id}`,
      dedupeKey: `grant:${r.id}`,
    });
    audit(db, actor.id, input.approve ? "grant.approve" : "grant.decline", "ai_course", r.id, { amount });
  });
}

// ── Student side ──────────────────────────────────────────────────────────────

/** Teachers who may review a student's course: their subject teachers and homeroom teacher. */
export function courseReviewers(db: Db, studentId: string) {
  const classes = studentClassIds(db, studentId);
  if (!classes.length) return [];
  const marks = classes.map(() => "?").join(",");
  return db.all<{ id: string; display_name: string; title: string | null }>(
    `SELECT DISTINCT u.id, u.display_name, u.title FROM users u
     WHERE u.role = 'teacher' AND u.active = 1 AND (
       u.id IN (SELECT teacher_id FROM teaching_assignments WHERE class_id IN (${marks})) OR
       u.id IN (SELECT homeroom_teacher_id FROM classes WHERE id IN (${marks})))
     ORDER BY u.display_name`,
    ...classes,
    ...classes,
  );
}

export function myAiCourses(db: Db, actor: Actor) {
  if (actor.role !== "student") throw forbidden();
  return db
    .all<Row & { reviewer: string }>(
      `SELECT c.*, u.display_name reviewer FROM ai_courses c JOIN users u ON u.id = c.reviewer_id WHERE c.student_id = ? ORDER BY c.created_at DESC`,
      actor.id,
    )
    .map((r) => {
      const c = content(r);
      return { id: r.id, title: r.title, summary: r.summary, status: r.status, reviewer: r.reviewer, skills: c.skills, lessons: c.lessons.length, lessonsDone: c.done.size, bestScore: r.best_score, grantApproved: r.grant_approved, grantStatus: r.grant_status, letterId: r.letter_id };
    });
}

/** Generate a course with AI and send it to the chosen teacher for review. */
export async function requestAiCourse(
  db: Db,
  actor: Actor,
  ai: AiProvider,
  input: { topic: string; reviewerId: string; grantRequested?: number; grantPurpose?: string | null },
) {
  if (actor.role !== "student") throw forbidden();
  const topic = input.topic.trim().replace(/\s+/g, " ");
  if (topic.length < 3 || topic.length > 80) throw invalid("Describe the topic in 3–80 characters, e.g. “First aid” or “Debate”.");
  if (!courseReviewers(db, actor.id).some((t) => t.id === input.reviewerId)) throw invalid("Choose one of your teachers to review the course.");
  const grantRequested = Math.round(Number(input.grantRequested) || 0);
  const grantPurpose = input.grantPurpose?.trim().slice(0, 1000) || null;
  if (grantRequested < 0) throw invalid("The grant amount isn't valid.");
  if (grantRequested > 0) {
    const g = grantEligibility(db, actor.id, actor.schoolId);
    if (!g.eligible) throw conflict(`You can't ask for a grant yet. ${g.reasons.join(" ")}`);
    if (grantRequested > g.maxAmount) throw invalid(`A grant can be at most ${g.maxAmount} ${grantBudget(db, actor.schoolId).currency}.`);
    if (!grantPurpose || grantPurpose.length < GRANT_RULES.minJustification)
      throw invalid(`Explain in at least ${GRANT_RULES.minJustification} characters what the grant pays for, what it costs and why you need it.`);
  }
  const open = db.get<{ c: number }>(`SELECT COUNT(*) c FROM ai_courses WHERE student_id = ? AND status = 'pending_review'`, actor.id)!.c;
  if (open >= MAX_OPEN_REQUESTS) throw conflict(`You already have ${MAX_OPEN_REQUESTS} courses waiting for review.`);
  if (!ai.course) throw conflict("Course generation needs the cloud AI or demo mode.");

  // Only the topic goes to the AI, never the student's name.
  const c = await ai.course(topic);
  // Re-check after the slow AI call so two requests sent at once can't both slip through.
  if (grantRequested > 0 && !grantEligibility(db, actor.id, actor.schoolId).eligible) throw conflict("You already have a grant request being decided.");
  const id = newId("aic_");
  db.run(
    `INSERT INTO ai_courses (id, school_id, student_id, reviewer_id, topic, title, summary, skills, lessons, quiz, grant_requested, grant_purpose, grant_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    actor.schoolId,
    actor.id,
    input.reviewerId,
    topic,
    c.title,
    c.summary,
    JSON.stringify(c.skills),
    JSON.stringify(c.lessons),
    JSON.stringify(c.quiz),
    grantRequested,
    grantPurpose,
    grantRequested > 0 ? "requested" : "none",
  );
  notify(db, input.reviewerId, {
    category: "academic",
    title: "A course is waiting for your review",
    body: `${actor.displayName} asked for an AI course: “${c.title}”${grantRequested ? ` with a grant request of ${grantRequested} ${grantBudget(db, actor.schoolId).currency}` : ""}.`,
    href: `/app/teacher/courses/${id}`,
    dedupeKey: `aic_req:${id}`,
  });
  audit(db, actor.id, "ai_course.request", "ai_course", id, { grantRequested });
  return id;
}

/**
 * Course page data for the student (lessons once approved, quiz without
 * answers) or the reviewing teacher (everything, including answers).
 */
export function aiCourseView(db: Db, actor: Actor, id: string) {
  const r = row(db, id);
  const isStudent = actor.role === "student" && r.student_id === actor.id;
  const isReviewer = actor.role === "teacher" && r.reviewer_id === actor.id;
  if (!isStudent && !isReviewer) throw notFound("Course not found.");
  const c = content(r);
  const open = isReviewer || STUDYING.includes(r.status);
  const people = db.get<{ student: string; reviewer: string }>(
    `SELECT s.display_name student, t.display_name reviewer FROM users s, users t WHERE s.id = ? AND t.id = ?`,
    r.student_id,
    r.reviewer_id,
  )!;
  return {
    id: r.id,
    topic: r.topic,
    title: r.title,
    summary: r.summary,
    skills: c.skills,
    status: r.status,
    student: people.student,
    studentId: r.student_id,
    reviewer: people.reviewer,
    reviewNote: r.review_note,
    grant: { requested: r.grant_requested, recommended: r.grant_recommended, approved: r.grant_approved, purpose: r.grant_purpose, status: r.grant_status, note: r.grant_note },
    bestScore: r.best_score,
    letterId: r.letter_id,
    createdAt: r.created_at,
    lessons: c.lessons.map((l, i) => ({ title: l.title, body: open ? l.body : null, done: c.done.has(i) })),
    quiz: open ? c.quiz.map((q) => ({ prompt: q.prompt, options: q.options, ...(isReviewer ? { answer: q.answer } : {}) })) : [],
  };
}

export function completeAiLesson(db: Db, actor: Actor, id: string, index: number) {
  const r = row(db, id);
  if (actor.role !== "student" || r.student_id !== actor.id) throw notFound("Course not found.");
  if (!STUDYING.includes(r.status)) throw conflict("Your teacher hasn't approved this course yet.");
  const c = content(r);
  if (!Number.isInteger(index) || index < 0 || index >= c.lessons.length) throw invalid("Unknown lesson.");
  c.done.add(index);
  db.run(`UPDATE ai_courses SET lessons_done = ? WHERE id = ?`, JSON.stringify([...c.done].sort((a, b) => a - b)), r.id);
  return c.done.size;
}

/** Grade on the server. Passing completes the course and asks the reviewer to accredit it. */
export function submitAiCourseQuiz(db: Db, actor: Actor, id: string, answers: string[]) {
  return db.tx(() => {
    const r = row(db, id);
    if (actor.role !== "student" || r.student_id !== actor.id) throw notFound("Course not found.");
    if (!STUDYING.includes(r.status)) throw conflict("Your teacher hasn't approved this course yet.");
    const c = content(r);
    if (c.done.size < c.lessons.length) throw conflict("Finish all lessons before the final quiz.");
    if (!Array.isArray(answers) || answers.length !== c.quiz.length) throw invalid("Answer every question first.");
    const correct = c.quiz.filter((q, i) => q.answer === String(answers[i])).length;
    const pct = Math.round((correct / c.quiz.length) * 100);
    const passed = pct >= COURSE_PASS_PCT;
    db.run(`UPDATE ai_courses SET best_score = MAX(COALESCE(best_score, 0), ?) WHERE id = ?`, pct, r.id);
    if (passed && r.status === "approved") {
      db.run(`UPDATE ai_courses SET status = 'completed', completed_at = datetime('now') WHERE id = ?`, r.id);
      grantXp(db, { userId: actor.id, amount: COURSE_COMPLETION_XP, reason: `Course completed: ${r.title}`, sourceType: "course", sourceId: r.id, key: `aic:${r.id}` });
      notify(db, r.reviewer_id, {
        category: "academic",
        title: "Course completed: ready to accredit",
        body: `${actor.displayName} passed “${r.title}” with ${pct}%. Accredit it with a letter of recommendation.`,
        href: `/app/teacher/courses/${r.id}`,
        dedupeKey: `aic_done:${r.id}`,
      });
    }
    return { correct, total: c.quiz.length, pct, passed };
  });
}

// ── Teacher side ──────────────────────────────────────────────────────────────

function reviewerRow(db: Db, actor: Actor, id: string) {
  const r = row(db, id);
  if (actor.role !== "teacher" || r.reviewer_id !== actor.id) throw notFound("Course not found.");
  assertAcademicRecord(db, actor, r.student_id);
  return r;
}

export function reviewQueue(db: Db, actor: Actor) {
  if (actor.role !== "teacher") throw forbidden();
  return db.all<{ id: string; title: string; topic: string; status: AiCourseStatus; grant_requested: number; grant_approved: number; grant_status: GrantStatus; best_score: number | null; created_at: string; student: string; avatar_hue: number }>(
    `SELECT c.id, c.title, c.topic, c.status, c.grant_requested, c.grant_approved, c.grant_status, c.best_score, c.created_at, u.display_name student, u.avatar_hue
     FROM ai_courses c JOIN users u ON u.id = c.student_id WHERE c.reviewer_id = ?
     ORDER BY CASE c.status WHEN 'pending_review' THEN 0 WHEN 'completed' THEN 1 WHEN 'approved' THEN 2 ELSE 3 END, c.created_at DESC`,
    actor.id,
  );
}

/** Approve (with an optional grant from the school budget) or send back the AI draft. */
export function reviewAiCourse(db: Db, actor: Actor, id: string, input: { approve: boolean; note?: string | null; grant?: number }) {
  return db.tx(() => {
    const r = reviewerRow(db, actor, id);
    if (r.status !== "pending_review") throw conflict("This course has already been reviewed.");
    const note = input.note?.trim().slice(0, 1000) || null;
    if (!input.approve && !note) throw invalid("Tell the student why the course was sent back.");
    // The teacher only recommends a grant; an administrator makes the final decision.
    const grant = input.approve && r.grant_status === "requested" ? Math.round(Number(input.grant) || 0) : 0;
    const b = grantBudget(db, r.school_id);
    const cap = Math.min(r.grant_requested, maxGrant(db, r.school_id));
    if (grant < 0 || grant > cap) throw invalid(`You can recommend at most ${cap} ${b.currency} (the request, the per-grant cap and what's left in the budget).`);
    const grantStatus: GrantStatus = r.grant_status !== "requested" ? r.grant_status : grant > 0 ? "recommended" : "declined";
    db.run(
      `UPDATE ai_courses SET status = ?, review_note = ?, grant_recommended = ?, grant_status = ?, reviewed_at = datetime('now') WHERE id = ?`,
      input.approve ? "approved" : "rejected",
      note,
      grant,
      grantStatus,
      r.id,
    );
    notify(db, r.student_id, {
      category: "academic",
      title: input.approve ? `Course approved: ${r.title}` : `Course sent back: ${r.title}`,
      body: input.approve
        ? `${actor.displayName} approved your course. You can start the lessons.${
            grantStatus === "recommended" ? ` Your grant request now goes to the school administration for a final decision.` : grantStatus === "declined" ? " Your teacher didn't recommend the grant." : ""
          }`
        : `${actor.displayName}: ${note}`,
      href: `/app/courses/ai/${r.id}`,
      dedupeKey: `aic_rev:${r.id}`,
    });
    if (grantStatus === "recommended") {
      for (const a of db.all<{ id: string }>(`SELECT id FROM users WHERE school_id = ? AND role = 'admin' AND active = 1`, r.school_id)) {
        notify(db, a.id, {
          category: "academic",
          title: "Grant waiting for your decision",
          body: `${actor.displayName} recommends ${grant} ${b.currency} for “${r.title}”.`,
          href: "/app/admin/grants",
          dedupeKey: `grant_rec:${r.id}`,
        });
      }
    }
    audit(db, actor.id, input.approve ? "ai_course.approve" : "ai_course.reject", "ai_course", r.id, { grantRecommended: grant });
  });
}

function letterFacts(db: Db, actor: Actor, r: Row) {
  return {
    ...studentFacts(db, actor, r.student_id, "course", null, new Date(), "teacher who reviewed the course"),
    purpose: "course" as const,
    course: { title: r.title, skills: json<string[]>(r.skills, []), score: r.best_score, lessons: json<GeneratedCourse["lessons"]>(r.lessons, []).map((l) => l.title) },
  };
}

/** AI draft of the accreditation letter; the teacher edits it before signing. */
export async function draftCourseLetter(db: Db, actor: Actor, ai: AiProvider, id: string) {
  const r = reviewerRow(db, actor, id);
  if (r.status !== "completed") throw conflict("The student needs to finish the course first.");
  const name = db.get<{ display_name: string }>(`SELECT display_name FROM users WHERE id = ?`, r.student_id)!.display_name;
  const draft = await ai.recommendation!(letterFacts(db, actor, r));
  return { text: draft.replaceAll("[Student]", name), simulated: ai.simulated };
}

/** Sign the letter: it accredits the course and goes into the student's Skills Passport. */
export function accreditAiCourse(db: Db, actor: Actor, id: string, body: string, now = new Date()) {
  return db.tx(() => {
    const r = reviewerRow(db, actor, id);
    if (r.status !== "completed") throw conflict(r.status === "accredited" ? "This course is already accredited." : "The student needs to finish the course first.");
    const text = body.trim();
    if (text.length < 200) throw invalid("The letter is too short (at least 200 characters).");
    if (text.length > 6000) throw invalid("The letter is too long (at most 6,000 characters).");
    const s = db.get<{ display_name: string; school_name: string; class_name: string | null }>(
      `SELECT u.display_name, sc.name school_name, (SELECT c.name FROM class_memberships m JOIN classes c ON c.id = m.class_id WHERE m.user_id = u.id) class_name
       FROM users u JOIN schools sc ON sc.id = u.school_id WHERE u.id = ?`,
      r.student_id,
    )!;
    const teacher = db.get<{ display_name: string; title: string | null }>(`SELECT display_name, title FROM users WHERE id = ?`, actor.id)!;
    const b = grantBudget(db, r.school_id);
    const letterId = issueCredential(
      db,
      {
        schoolId: r.school_id,
        studentId: r.student_id,
        kind: "recommendation",
        title: `Course accreditation and recommendation: ${r.title}`,
        payload: {
          studentName: s.display_name,
          className: s.class_name,
          schoolName: s.school_name,
          purpose: "course",
          recipient: null,
          body: text,
          teacherName: teacher.display_name,
          teacherTitle: teacher.title,
          course: { title: r.title, skills: json<string[]>(r.skills, []), score: r.best_score, completedAt: r.completed_at, grant: r.grant_status === "approved" ? `${r.grant_approved} ${b.currency}` : null },
        },
        issuedBy: actor.id,
      },
      now,
    );
    // An approved grant is only paid out now that the course is accredited.
    db.run(
      `UPDATE ai_courses SET status = 'accredited', letter_id = ?, accredited_at = datetime('now'), grant_status = CASE grant_status WHEN 'approved' THEN 'released' ELSE grant_status END WHERE id = ?`,
      letterId,
      r.id,
    );
    notify(db, r.student_id, {
      category: "academic",
      title: `Course accredited: ${r.title}`,
      body: `${teacher.display_name} accredited your course with a signed letter of recommendation. It's in your Skills Passport.`,
      href: "/app/passport",
      dedupeKey: `aic_acc:${r.id}`,
    });
    return letterId;
  });
}
