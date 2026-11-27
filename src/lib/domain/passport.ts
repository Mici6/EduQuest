import type { Actor } from "../auth/types";
import { assertAcademicRecord, studentClassIds } from "../auth/policy";
import { conflict, forbidden, invalid, notFound } from "../auth/errors";
import type { AiProvider, RecommendationInput } from "../ai/types";
import type { Db } from "../db/client";
import { json, newId } from "../db/client";
import { daysBetween, toDate } from "../utils/dates";
import { audit } from "./audit";
import { attendanceFor, attendanceStats, overallAverage, subjectSummaries } from "./catalog";
import { courseById } from "./course-catalog";
import { credentialsForStudent, issueCredential } from "./credentials";
import { notify } from "./notifications";

/**
 * Skills Passport: everything a student has done that the school can vouch
 * for (verified volunteering, badges, completed courses, projects,
 * recommendation letters), issuable as a school-sealed document.
 */

export const RECOMMENDATION_MIN_DAYS = 365;
const hours = (minutes: number) => Math.round(minutes / 6) / 10;

function student(db: Db, studentId: string) {
  const s = db.get<{ id: string; display_name: string; school_id: string; school_name: string; created_at: string; role: string }>(
    `SELECT u.id, u.display_name, u.school_id, s.name school_name, u.created_at, u.role FROM users u JOIN schools s ON s.id = u.school_id WHERE u.id = ?`,
    studentId,
  );
  if (!s || s.role !== "student") throw notFound("Student not found.");
  const cls = db.get<{ name: string }>(`SELECT c.name FROM class_memberships m JOIN classes c ON c.id = m.class_id WHERE m.user_id = ?`, studentId);
  return { ...s, className: cls?.name ?? null };
}

export function passportData(db: Db, actor: Actor, studentId: string) {
  if (actor.role === "support") throw forbidden();
  assertAcademicRecord(db, actor, studentId);
  const s = student(db, studentId);
  const volunteering = db.all<{ id: string; title: string; category: string; starts_at: string; duration_minutes: number; verified_at: string; verifier: string | null }>(
    `SELECT r.id, a.title, a.category, a.starts_at, a.duration_minutes, r.verified_at, u.display_name verifier
     FROM volunteering_registrations r JOIN volunteering_activities a ON a.id = r.activity_id LEFT JOIN users u ON u.id = r.verified_by
     WHERE r.student_id = ? AND r.status = 'verified' ORDER BY a.starts_at DESC`,
    studentId,
  );
  const badges = db.all<{ title: string; description: string; tier: string; icon: string; earned_at: string }>(
    `SELECT a.title, a.description, a.tier, a.icon, sa.earned_at FROM student_achievements sa JOIN achievements a ON a.id = sa.achievement_id
     WHERE sa.user_id = ? ORDER BY sa.earned_at DESC`,
    studentId,
  );
  const courses = db
    .all<{ course_id: string; completed_at: string; best_score: number | null; certificate_id: string | null }>(
      `SELECT course_id, completed_at, best_score, certificate_id FROM course_enrollments WHERE student_id = ? AND completed_at IS NOT NULL ORDER BY completed_at DESC`,
      studentId,
    )
    .map((c) => ({ ...c, title: courseById(c.course_id)?.title ?? c.course_id, skills: courseById(c.course_id)?.skills ?? [] }))
    .concat(
      db
        .all<{ course_id: string; completed_at: string; best_score: number | null; certificate_id: string | null; title: string; skills: string }>(
          `SELECT id course_id, completed_at, best_score, letter_id certificate_id, title, skills FROM ai_courses WHERE student_id = ? AND status = 'accredited'`,
          studentId,
        )
        .map((c) => ({ ...c, title: `${c.title} (teacher-accredited)`, skills: json<string[]>(c.skills, []) })),
    )
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at));
  const projects = db.all<{ id: string; title: string; description: string; link: string | null; created_at: string; verified_at: string | null; verifier: string | null }>(
    `SELECT p.id, p.title, p.description, p.link, p.created_at, p.verified_at, u.display_name verifier
     FROM portfolio_projects p LEFT JOIN users u ON u.id = p.verified_by WHERE p.student_id = ? ORDER BY p.created_at DESC`,
    studentId,
  );
  return {
    student: { id: s.id, name: s.display_name, className: s.className, schoolName: s.school_name, memberSince: s.created_at },
    volunteering: volunteering.map((v) => ({ ...v, hours: hours(v.duration_minutes) })),
    volunteeringHours: hours(volunteering.reduce((n, v) => n + v.duration_minutes, 0)),
    badges,
    courses,
    projects,
    credentials: credentialsForStudent(db, studentId),
  };
}

export type Passport = ReturnType<typeof passportData>;

// ── Projects ─────────────────────────────────────────────────────────────────

export function addProject(db: Db, actor: Actor, input: { title: string; description: string; link?: string | null }) {
  if (actor.role !== "student") throw forbidden();
  const title = input.title.trim();
  const description = input.description.trim();
  const link = input.link?.trim() || null;
  if (title.length < 3 || title.length > 120) throw invalid("Give the project a title (3–120 characters).");
  if (description.length < 10 || description.length > 1000) throw invalid("Describe the project in 10–1,000 characters.");
  if (link && (!/^https?:\/\/[^\s]+$/i.test(link) || link.length > 300)) throw invalid("The link must start with http:// or https://.");
  const n = db.get<{ c: number }>(`SELECT COUNT(*) c FROM portfolio_projects WHERE student_id = ?`, actor.id)!.c;
  if (n >= 30) throw conflict("You can list up to 30 projects.");
  const id = newId("prj_");
  db.run(`INSERT INTO portfolio_projects (id, student_id, title, description, link) VALUES (?, ?, ?, ?, ?)`, id, actor.id, title, description, link);
  return id;
}

export function deleteProject(db: Db, actor: Actor, id: string) {
  const res = db.run(`DELETE FROM portfolio_projects WHERE id = ? AND student_id = ?`, id, actor.id);
  if (Number(res.changes) === 0) throw notFound();
}

/** A teacher of the student's class confirms (or withdraws confirmation of) a project. */
export function verifyProject(db: Db, actor: Actor, projectId: string, verified: boolean) {
  if (actor.role !== "teacher") throw forbidden();
  const p = db.get<{ id: string; student_id: string; title: string }>(`SELECT id, student_id, title FROM portfolio_projects WHERE id = ?`, projectId);
  if (!p) throw notFound("Project not found.");
  assertAcademicRecord(db, actor, p.student_id);
  if (verified) {
    db.run(`UPDATE portfolio_projects SET verified_by = ?, verified_at = datetime('now') WHERE id = ?`, actor.id, p.id);
    notify(db, p.student_id, { category: "academic", title: "Project verified", body: `${actor.displayName} verified “${p.title}”. It now counts as verified in your Skills Passport.`, href: "/app/passport", dedupeKey: `prj_ok:${p.id}` });
  } else {
    db.run(`UPDATE portfolio_projects SET verified_by = NULL, verified_at = NULL WHERE id = ?`, p.id);
  }
  audit(db, actor.id, verified ? "project.verify" : "project.unverify", "portfolio_project", p.id);
}

// ── Issuing the passport ──────────────────────────────────────────────────────

/** Freeze the current passport into a school-sealed document with a public verification link. */
export function issuePassport(db: Db, actor: Actor, now = new Date()) {
  if (actor.role !== "student") throw forbidden();
  const today = db.get<{ c: number }>(
    `SELECT COUNT(*) c FROM credentials WHERE student_id = ? AND kind = 'passport' AND issued_at >= datetime('now', '-1 day')`,
    actor.id,
  )!.c;
  if (today >= 10) throw conflict("You've issued 10 passports today. Try again tomorrow.");
  const p = passportData(db, actor, actor.id);
  const letters = p.credentials.filter((c) => c.kind === "recommendation" && !c.revoked_at);
  return issueCredential(
    db,
    {
      schoolId: actor.schoolId,
      studentId: actor.id,
      kind: "passport",
      title: `Skills Passport: ${p.student.name}`,
      payload: {
        studentName: p.student.name,
        className: p.student.className,
        schoolName: p.student.schoolName,
        memberSince: p.student.memberSince,
        volunteeringHours: p.volunteeringHours,
        volunteering: p.volunteering.map((v) => ({ title: v.title, category: v.category, date: v.starts_at, hours: v.hours, verifiedBy: v.verifier })),
        badges: p.badges.map((b) => ({ title: b.title, tier: b.tier, earnedAt: b.earned_at })),
        courses: p.courses.map((c) => ({ title: c.title, completedAt: c.completed_at, score: c.best_score, certificateId: c.certificate_id })),
        projects: p.projects.map((x) => ({ title: x.title, description: x.description, link: x.link, verifiedBy: x.verifier })),
        recommendations: letters.map((l) => ({ id: l.id, title: l.title, issuedAt: l.issued_at, by: l.issuer_name })),
      },
      issuedBy: null,
    },
    now,
  );
}

// ── Recommendation letters ──────────────────────────────────────────────────────

/** The responsible teacher is the homeroom teacher of the student's class. */
function assertHomeroomTeacher(db: Db, actor: Actor, studentId: string) {
  if (actor.role !== "teacher") throw forbidden();
  const classes = studentClassIds(db, studentId);
  const ok = classes.some((c) => db.get(`SELECT 1 FROM classes WHERE id = ? AND homeroom_teacher_id = ?`, c, actor.id));
  if (!ok) throw forbidden("Only the student's homeroom teacher can write their recommendation letter.");
}

export function recommendationEligibility(db: Db, studentId: string, now = new Date()) {
  const s = student(db, studentId);
  const days = daysBetween(toDate(s.created_at), now);
  return { eligible: days >= RECOMMENDATION_MIN_DAYS, daysActive: days, daysLeft: Math.max(0, RECOMMENDATION_MIN_DAYS - days) };
}

/** Students in classes where the actor is the homeroom teacher, with passport highlights. */
export function homeroomStudents(db: Db, actor: Actor, now = new Date()) {
  if (actor.role !== "teacher") throw forbidden();
  return db
    .all<{ id: string; display_name: string; class_name: string; avatar_hue: number }>(
      `SELECT u.id, u.display_name, c.name class_name, u.avatar_hue FROM classes c JOIN class_memberships m ON m.class_id = c.id
       JOIN users u ON u.id = m.user_id WHERE c.homeroom_teacher_id = ? AND u.role = 'student' AND u.active = 1 ORDER BY c.name, u.display_name`,
      actor.id,
    )
    .map((s) => ({
      ...s,
      ...recommendationEligibility(db, s.id, now),
      verifiedHours: hours(
        db.get<{ m: number }>(
          `SELECT COALESCE(SUM(a.duration_minutes), 0) m FROM volunteering_registrations r JOIN volunteering_activities a ON a.id = r.activity_id WHERE r.student_id = ? AND r.status = 'verified'`,
          s.id,
        )!.m,
      ),
      pendingProjects: db.get<{ c: number }>(`SELECT COUNT(*) c FROM portfolio_projects WHERE student_id = ? AND verified_at IS NULL`, s.id)!.c,
      letters: db.get<{ c: number }>(`SELECT COUNT(*) c FROM credentials WHERE student_id = ? AND kind = 'recommendation' AND revoked_at IS NULL`, s.id)!.c,
    }));
}

const PURPOSES = ["university", "scholarship", "volunteering"] as const;
export type RecommendationPurpose = (typeof PURPOSES)[number];
const cleanPurpose = (p: string): RecommendationPurpose => (PURPOSES.includes(p as RecommendationPurpose) ? (p as RecommendationPurpose) : "university");

/** Facts for the letter, built from app data. Contains no name (see RecommendationInput). */
export function recommendationFacts(db: Db, actor: Actor, studentId: string, purpose: string, recipient: string | null, now = new Date()): RecommendationInput {
  assertHomeroomTeacher(db, actor, studentId);
  return studentFacts(db, actor, studentId, purpose, recipient, now, "homeroom teacher");
}

/** The same facts for any teacher allowed to see the student's record (e.g. a course reviewer). */
export function studentFacts(db: Db, actor: Actor, studentId: string, purpose: string, recipient: string | null, now: Date, teacherRole: string): RecommendationInput {
  const p = passportData(db, actor, studentId);
  const att = attendanceStats(attendanceFor(db, actor, studentId));
  return {
    purpose: cleanPurpose(purpose),
    recipient: recipient?.trim().slice(0, 120) || null,
    teacherRole,
    monthsKnown: Math.max(1, Math.round(recommendationEligibility(db, studentId, now).daysActive / 30.4)),
    volunteering: p.volunteering.map((v) => ({ title: v.title, hours: v.hours })),
    totalHours: p.volunteeringHours,
    badges: p.badges.map((b) => b.title),
    courses: p.courses.map((c) => c.title),
    projects: p.projects.map((x) => ({ title: x.title, description: x.description.slice(0, 300), verified: !!x.verified_at })),
    average: overallAverage(subjectSummaries(db, actor, studentId)),
    attendancePct: att.rate,
  };
}

export async function draftRecommendation(db: Db, actor: Actor, ai: AiProvider, studentId: string, purpose: string, recipient: string | null) {
  const facts = recommendationFacts(db, actor, studentId, purpose, recipient);
  if (!recommendationEligibility(db, studentId).eligible) throw conflict("Recommendation letters are available after one year of activity in EduQuest.");
  const name = student(db, studentId).display_name;
  const draft = await ai.recommendation!(facts);
  return { text: draft.replaceAll("[Student]", name), simulated: ai.simulated };
}

/** The homeroom teacher signs and issues the (edited) letter as a sealed document. */
export function issueRecommendation(db: Db, actor: Actor, studentId: string, input: { purpose: string; recipient: string | null; body: string }, now = new Date()) {
  assertHomeroomTeacher(db, actor, studentId);
  if (!recommendationEligibility(db, studentId, now).eligible) throw conflict("Recommendation letters are available after one year of activity in EduQuest.");
  const body = input.body.trim();
  if (body.length < 200) throw invalid("The letter is too short (at least 200 characters).");
  if (body.length > 6000) throw invalid("The letter is too long (at most 6,000 characters).");
  const s = student(db, studentId);
  const teacher = db.get<{ display_name: string; title: string | null }>(`SELECT display_name, title FROM users WHERE id = ?`, actor.id)!;
  const facts = recommendationFacts(db, actor, studentId, input.purpose, input.recipient, now);
  const id = issueCredential(
    db,
    {
      schoolId: actor.schoolId,
      studentId,
      kind: "recommendation",
      title: `Letter of recommendation for ${s.display_name}`,
      payload: {
        studentName: s.display_name,
        className: s.className,
        schoolName: s.school_name,
        purpose: facts.purpose,
        recipient: facts.recipient,
        body,
        teacherName: teacher.display_name,
        teacherTitle: teacher.title,
        basedOn: { volunteeringHours: facts.totalHours, badges: facts.badges.length, courses: facts.courses.length, projects: facts.projects.length },
      },
      issuedBy: actor.id,
    },
    now,
  );
  notify(db, studentId, {
    category: "academic",
    title: "You received a recommendation letter",
    body: `${teacher.display_name} signed a letter of recommendation for you. It's in your Skills Passport.`,
    href: "/app/passport",
    dedupeKey: `rec:${id}`,
  });
  return id;
}
