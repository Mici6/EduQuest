import type { Actor } from "../auth/types";
import {
  assertAcademicRecord,
  assertCan,
  assertTeacherOfClass,
  studentClassIds,
  teacherClassIds,
} from "../auth/policy";
import { conflict, forbidden, invalid, notFound } from "../auth/errors";
import type { Db } from "../db/client";
import { newId } from "../db/client";
import { addDays, isoDate, isoWeekKey, parseIso, startOfWeek, toDate, weekday } from "../utils/dates";
import { audit } from "./audit";
import { evaluateAchievements, grantXp, recordProgress } from "./gamification";
import { notify } from "./notifications";

export type Subject = { id: string; name: string; short: string; color: string; icon: string };

export type GradeRow = {
  id: string;
  subject_id: string;
  subject_name: string;
  subject_color: string;
  value: number;
  weight: number;
  kind: string;
  title: string;
  graded_on: string;
  teacher_name: string;
};

export function subjectsForSchool(db: Db, schoolId: string): Subject[] {
  return db.all<Subject>(`SELECT id, name, short, color, icon FROM subjects WHERE school_id = ? ORDER BY name`, schoolId);
}

export function weightedAverage(rows: { value: number; weight: number }[]): number | null {
  const w = rows.reduce((s, r) => s + r.weight, 0);
  if (!w) return null;
  return Math.round((rows.reduce((s, r) => s + r.value * r.weight, 0) / w) * 100) / 100;
}

export function gradesFor(db: Db, actor: Actor, studentId: string): GradeRow[] {
  assertAcademicRecord(db, actor, studentId);
  return db.all<GradeRow>(
    `SELECT g.id, g.subject_id, s.name subject_name, s.color subject_color, g.value, g.weight, g.kind, g.title, g.graded_on, t.display_name teacher_name
     FROM grades g JOIN subjects s ON s.id = g.subject_id JOIN users t ON t.id = g.teacher_id
     WHERE g.student_id = ? ORDER BY g.graded_on DESC, g.created_at DESC`,
    studentId,
  );
}

export type SubjectSummary = Subject & {
  average: number | null;
  count: number;
  trend: number | null;
  teacher_name: string | null;
  last: number | null;
};

/** Per-subject averages plus a simple trend (last 3 vs previous 3 grades). */
export function subjectSummaries(db: Db, actor: Actor, studentId: string): SubjectSummary[] {
  const grades = gradesFor(db, actor, studentId);
  const classIds = studentClassIds(db, studentId);
  const subjects = db.all<Subject & { teacher_name: string | null }>(
    `SELECT DISTINCT s.id, s.name, s.short, s.color, s.icon,
       (SELECT u.display_name FROM teaching_assignments ta JOIN users u ON u.id = ta.teacher_id
        WHERE ta.subject_id = s.id AND ta.class_id IN (${classIds.map(() => "?").join(",") || "''"}) LIMIT 1) teacher_name
     FROM subjects s JOIN teaching_assignments ta ON ta.subject_id = s.id
     WHERE ta.class_id IN (${classIds.map(() => "?").join(",") || "''"}) ORDER BY s.name`,
    ...classIds,
    ...classIds,
  );
  return subjects.map((s) => {
    const mine = grades.filter((g) => g.subject_id === s.id).sort((a, b) => a.graded_on.localeCompare(b.graded_on));
    const recent = mine.slice(-3);
    const before = mine.slice(-6, -3);
    const trend = recent.length && before.length ? (weightedAverage(recent)! - weightedAverage(before)!) : null;
    return {
      ...s,
      average: weightedAverage(mine),
      count: mine.length,
      trend: trend == null ? null : Math.round(trend * 100) / 100,
      last: mine.at(-1)?.value ?? null,
    };
  });
}

export function overallAverage(summaries: SubjectSummary[]): number | null {
  const vals = summaries.map((s) => s.average).filter((v): v is number => v != null);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}

/** Cumulative overall average at the end of each week (chart data). */
export function gradeProgression(db: Db, actor: Actor, studentId: string, weeks = 10, today = new Date()) {
  const grades = gradesFor(db, actor, studentId);
  const out: { week: string; label: string; average: number | null }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = addDays(startOfWeek(today), 7 * -i + 6);
    const upTo = grades.filter((g) => parseIso(g.graded_on) <= end);
    out.push({ week: isoWeekKey(end), label: end.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), average: weightedAverage(upTo) });
  }
  return out;
}

// ── Attendance ─────────────────────────────────────────────────────────────

export type AttendanceRow = { id: string; date: string; status: "present" | "absent" | "late" | "excused"; subject_name: string; subject_color: string; note: string | null };

export function attendanceFor(db: Db, actor: Actor, studentId: string): AttendanceRow[] {
  assertAcademicRecord(db, actor, studentId);
  return db.all<AttendanceRow>(
    `SELECT a.id, a.date, a.status, s.name subject_name, s.color subject_color, a.note
     FROM attendance a JOIN subjects s ON s.id = a.subject_id WHERE a.student_id = ? ORDER BY a.date DESC`,
    studentId,
  );
}

export function attendanceStats(rows: { status: string }[]) {
  const total = rows.length;
  const by = (s: string) => rows.filter((r) => r.status === s).length;
  const present = by("present");
  const late = by("late");
  return {
    total,
    present,
    late,
    absent: by("absent"),
    excused: by("excused"),
    rate: total ? Math.round(((present + late) / total) * 1000) / 10 : null,
  };
}

// ── Schedule ─────────────────────────────────────────────────────────────────

export type SlotRow = {
  id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  room: string;
  subject_id: string;
  subject_name: string;
  subject_short: string;
  subject_color: string;
  teacher_name: string;
  class_name: string;
  class_id: string;
};

export function scheduleFor(db: Db, actor: Actor): SlotRow[] {
  let where: string;
  let params: string[];
  if (actor.role === "student") {
    const ids = studentClassIds(db, actor.id);
    where = `sl.class_id IN (${ids.map(() => "?").join(",") || "''"})`;
    params = ids;
  } else if (actor.role === "teacher") {
    where = `sl.teacher_id = ?`;
    params = [actor.id];
  } else {
    throw forbidden();
  }
  return db.all<SlotRow>(
    `SELECT sl.id, sl.weekday, sl.starts_at, sl.ends_at, sl.room, s.id subject_id, s.name subject_name, s.short subject_short, s.color subject_color,
            u.display_name teacher_name, c.name class_name, c.id class_id
     FROM schedule_slots sl JOIN subjects s ON s.id = sl.subject_id JOIN users u ON u.id = sl.teacher_id JOIN classes c ON c.id = sl.class_id
     WHERE ${where} ORDER BY sl.weekday, sl.starts_at`,
    ...params,
  );
}

export function todaysClasses(db: Db, actor: Actor, now = new Date()) {
  const wd = weekday(now);
  const hhmm = now.toTimeString().slice(0, 5);
  const slots = scheduleFor(db, actor).filter((s) => s.weekday === wd);
  return slots.map((s) => ({ ...s, state: s.ends_at <= hhmm ? "done" : s.starts_at <= hhmm ? "now" : "upcoming" as "done" | "now" | "upcoming" }));
}

/** Next class from now, looking ahead up to a week. */
export function nextClass(db: Db, actor: Actor, now = new Date()) {
  const slots = scheduleFor(db, actor);
  const hhmm = now.toTimeString().slice(0, 5);
  for (let i = 0; i < 7; i++) {
    const day = addDays(now, i);
    const wd = weekday(day);
    const match = slots.find((s) => s.weekday === wd && (i > 0 || s.starts_at > hhmm));
    if (match) return { ...match, date: isoDate(day), inDays: i };
  }
  return null;
}

// ── Homework ──────────────────────────────────────────────────────────────────

export type HomeworkRow = {
  id: string;
  title: string;
  description: string;
  due_at: string;
  subject_name: string;
  subject_color: string;
  subject_id: string;
  teacher_name: string;
  class_id: string;
  submission_id: string | null;
  submitted_at: string | null;
  submission_status: string | null;
  feedback: string | null;
  body: string | null;
  file_name: string | null;
};

export function homeworkFor(db: Db, actor: Actor, studentId: string): (HomeworkRow & { state: "submitted" | "returned" | "overdue" | "due_soon" | "open" })[] {
  assertAcademicRecord(db, actor, studentId);
  const ids = studentClassIds(db, studentId);
  const rows = db.all<HomeworkRow>(
    `SELECT a.id, a.title, a.description, a.due_at, s.name subject_name, s.color subject_color, s.id subject_id, u.display_name teacher_name, a.class_id,
            sub.id submission_id, sub.submitted_at, sub.status submission_status, sub.feedback, sub.body, sub.file_name
     FROM assignments a JOIN subjects s ON s.id = a.subject_id JOIN users u ON u.id = a.teacher_id
     LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = ?
     WHERE a.status = 'published' AND a.class_id IN (${ids.map(() => "?").join(",") || "''"})
     ORDER BY a.due_at`,
    studentId,
    ...ids,
  );
  const now = Date.now();
  return rows.map((r) => {
    const due = toDate(r.due_at).getTime();
    const state = r.submission_status === "returned" ? "returned" : r.submission_id ? "submitted" : due < now ? "overdue" : due - now < 2 * 86400000 ? "due_soon" : "open";
    return { ...r, state };
  });
}

export function submitHomework(db: Db, actor: Actor, assignmentId: string, input: { body: string; fileName?: string | null }) {
  assertCan(actor, "homework.submit");
  const body = input.body.trim();
  if (body.length < 2 && !input.fileName) throw invalid("Add an answer or attach a file before submitting.");
  if (body.length > 20000) throw invalid("Your answer is too long (max 20,000 characters).");
  return db.tx(() => {
    const a = db.get<{ id: string; class_id: string; status: string; title: string; teacher_id: string }>(
      `SELECT id, class_id, status, title, teacher_id FROM assignments WHERE id = ?`,
      assignmentId,
    );
    if (!a || a.status !== "published" || !studentClassIds(db, actor.id).includes(a.class_id)) throw notFound("Assignment not found.");
    const existing = db.get<{ id: string; status: string }>(`SELECT id, status FROM submissions WHERE assignment_id = ? AND student_id = ?`, a.id, actor.id);
    if (existing?.status === "returned") throw conflict("This submission was already returned by your teacher.");
    if (existing) {
      db.run(`UPDATE submissions SET body = ?, file_name = COALESCE(?, file_name), submitted_at = datetime('now') WHERE id = ?`, body, input.fileName ?? null, existing.id);
      return { id: existing.id, xp: 0, resubmitted: true };
    }
    const id = newId("sub_");
    db.run(`INSERT INTO submissions (id, assignment_id, student_id, body, file_name) VALUES (?, ?, ?, ?, ?)`, id, a.id, actor.id, body, input.fileName ?? null);
    const xp = grantXp(db, { userId: actor.id, amount: 20, reason: `Homework submitted: ${a.title}`, sourceType: "assignment", sourceId: a.id, key: `submit:${a.id}:${actor.id}` });
    recordProgress(db, actor.id, "assignment_submitted");
    evaluateAchievements(db, actor.id);
    return { id, xp, resubmitted: false };
  });
}

// ── Announcements & events ───────────────────────────────────────────────────────

export function announcementsFor(db: Db, actor: Actor, limit = 20) {
  const classIds = actor.role === "student" ? studentClassIds(db, actor.id) : actor.role === "teacher" ? teacherClassIds(db, actor.id) : [];
  const classFilter = actor.role === "admin" ? "" : `AND (a.class_id IS NULL OR a.class_id IN (${classIds.map(() => "?").join(",") || "''"}))`;
  return db.all<{ id: string; title: string; body: string; pinned: number; created_at: string; author_name: string; class_name: string | null }>(
    `SELECT a.id, a.title, a.body, a.pinned, a.created_at, u.display_name author_name, c.name class_name
     FROM announcements a JOIN users u ON u.id = a.author_id LEFT JOIN classes c ON c.id = a.class_id
     WHERE a.school_id = ? ${classFilter} ORDER BY a.pinned DESC, a.created_at DESC LIMIT ?`,
    actor.schoolId,
    ...(actor.role === "admin" ? [] : classIds),
    limit,
  );
}

export function upcomingEvents(db: Db, actor: Actor, days = 21, now = new Date()) {
  const classIds = actor.role === "student" ? studentClassIds(db, actor.id) : actor.role === "teacher" ? teacherClassIds(db, actor.id) : [];
  return db.all<{ id: string; title: string; kind: string; date: string; class_name: string | null }>(
    `SELECT e.id, e.title, e.kind, e.date, c.name class_name FROM events e LEFT JOIN classes c ON c.id = e.class_id
     WHERE e.school_id = ? AND e.date >= ? AND e.date <= ?
       AND (e.class_id IS NULL ${actor.role === "admin" ? "OR 1" : `OR e.class_id IN (${classIds.map(() => "?").join(",") || "''"})`})
     ORDER BY e.date`,
    actor.schoolId,
    isoDate(now),
    isoDate(addDays(now, days)),
    ...(actor.role === "admin" ? [] : classIds),
  );
}

export function teachersFor(db: Db, actor: Actor) {
  const ids = studentClassIds(db, actor.id);
  return db.all<{ id: string; display_name: string; title: string | null; avatar_hue: number; subjects: string }>(
    `SELECT u.id, u.display_name, u.title, u.avatar_hue, GROUP_CONCAT(DISTINCT s.name) subjects
     FROM teaching_assignments ta JOIN users u ON u.id = ta.teacher_id JOIN subjects s ON s.id = ta.subject_id
     WHERE ta.class_id IN (${ids.map(() => "?").join(",") || "''"}) GROUP BY u.id ORDER BY u.display_name`,
    ...ids,
  );
}

// ── Teacher operations ───────────────────────────────────────────────────────────

export function teacherClasses(db: Db, actor: Actor) {
  if (actor.role !== "teacher") throw forbidden();
  return db.all<{ class_id: string; class_name: string; grade_level: number; subject_id: string; subject_name: string; subject_color: string; students: number }>(
    `SELECT c.id class_id, c.name class_name, c.grade_level, s.id subject_id, s.name subject_name, s.color subject_color,
            (SELECT COUNT(*) FROM class_memberships cm JOIN users u ON u.id = cm.user_id WHERE cm.class_id = c.id AND u.role = 'student') students
     FROM teaching_assignments ta JOIN classes c ON c.id = ta.class_id JOIN subjects s ON s.id = ta.subject_id
     WHERE ta.teacher_id = ? ORDER BY c.name, s.name`,
    actor.id,
  );
}

export function classRoster(db: Db, actor: Actor, classId: string, subjectId: string) {
  assertTeacherOfClass(db, actor, classId, subjectId);
  const students = db.all<{ id: string; display_name: string; avatar_hue: number }>(
    `SELECT u.id, u.display_name, u.avatar_hue FROM class_memberships cm JOIN users u ON u.id = cm.user_id
     WHERE cm.class_id = ? AND u.role = 'student' AND u.active = 1 ORDER BY u.display_name`,
    classId,
  );
  const published = db.get<{ c: number }>(
    `SELECT COUNT(*) c FROM assignments WHERE class_id = ? AND subject_id = ? AND status = 'published' AND due_at < datetime('now')`,
    classId,
    subjectId,
  )!.c;
  return students.map((s) => {
    const grades = db.all<{ value: number; weight: number; graded_on: string }>(
      `SELECT value, weight, graded_on FROM grades WHERE student_id = ? AND subject_id = ? AND class_id = ? ORDER BY graded_on`,
      s.id,
      subjectId,
      classId,
    );
    const att = db.all<{ status: string }>(`SELECT status FROM attendance WHERE student_id = ? AND subject_id = ?`, s.id, subjectId);
    const submitted = db.get<{ c: number }>(
      `SELECT COUNT(*) c FROM submissions sub JOIN assignments a ON a.id = sub.assignment_id
       WHERE sub.student_id = ? AND a.class_id = ? AND a.subject_id = ? AND a.due_at < datetime('now')`,
      s.id,
      classId,
      subjectId,
    )!.c;
    return {
      ...s,
      average: weightedAverage(grades),
      gradeCount: grades.length,
      lastGrade: grades.at(-1)?.value ?? null,
      attendanceRate: attendanceStats(att).rate,
      completion: published ? Math.round((submitted / published) * 100) : null,
    };
  });
}

export function classStats(db: Db, actor: Actor, classId: string, subjectId: string) {
  const roster = classRoster(db, actor, classId, subjectId);
  const avgs = roster.map((r) => r.average).filter((v): v is number => v != null);
  const atts = roster.map((r) => r.attendanceRate).filter((v): v is number => v != null);
  const comps = roster.map((r) => r.completion).filter((v): v is number => v != null);
  const mean = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);
  const distribution = [4, 5, 6, 7, 8, 9, 10].map((b) => ({ band: b === 4 ? "≤4" : String(b), count: avgs.filter((v) => (b === 4 ? v < 5 : v >= b && v < b + 1) || (b === 10 && v === 10)).length }));
  return { students: roster.length, average: mean(avgs), attendance: mean(atts), completion: mean(comps), distribution, roster };
}

export function addGrade(
  db: Db,
  actor: Actor,
  input: { studentId: string; classId: string; subjectId: string; value: number; kind: string; title: string; gradedOn: string; weight?: number },
) {
  assertCan(actor, "grades.write");
  assertTeacherOfClass(db, actor, input.classId, input.subjectId);
  if (!studentClassIds(db, input.studentId).includes(input.classId)) throw invalid("That student is not in this class.");
  if (!(input.value >= 1 && input.value <= 10)) throw invalid("Grades must be between 1 and 10.");
  if (!["test", "quiz", "oral", "project", "homework"].includes(input.kind)) throw invalid("Unknown assessment type.");
  const title = input.title.trim();
  if (!title || title.length > 120) throw invalid("Give the assessment a title (max 120 characters).");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.gradedOn)) throw invalid("Invalid date.");
  const weight = input.weight ?? (input.kind === "test" ? 2 : 1);
  const id = newId("grd_");
  db.tx(() => {
    db.run(
      `INSERT INTO grades (id, student_id, class_id, subject_id, teacher_id, value, weight, kind, title, graded_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.studentId,
      input.classId,
      input.subjectId,
      actor.id,
      Math.round(input.value * 100) / 100,
      weight,
      input.kind,
      title,
      input.gradedOn,
    );
    const subject = db.get<{ name: string }>(`SELECT name FROM subjects WHERE id = ?`, input.subjectId)!;
    notify(db, input.studentId, {
      category: "academic",
      title: `New grade in ${subject.name}`,
      body: `${title}: ${input.value}`,
      href: "/app/catalog?tab=grades",
      dedupeKey: `grade:${id}`,
    });
    audit(db, actor.id, "grades.create", "grade", id, { classId: input.classId });
  });
  return id;
}

export function recordAttendance(
  db: Db,
  actor: Actor,
  input: { classId: string; subjectId: string; date: string; entries: { studentId: string; status: "present" | "absent" | "late" | "excused" }[] },
) {
  assertCan(actor, "attendance.write");
  assertTeacherOfClass(db, actor, input.classId, input.subjectId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw invalid("Invalid date.");
  const members = new Set(
    db
      .all<{ user_id: string }>(
        `SELECT cm.user_id FROM class_memberships cm JOIN users u ON u.id = cm.user_id WHERE cm.class_id = ? AND u.role = 'student'`,
        input.classId,
      )
      .map((r) => r.user_id),
  );
  db.tx(() => {
    for (const e of input.entries) {
      if (!members.has(e.studentId)) throw invalid("A student in the list is not in this class.");
      if (!["present", "absent", "late", "excused"].includes(e.status)) throw invalid("Unknown attendance status.");
      db.run(
        `INSERT INTO attendance (id, student_id, class_id, subject_id, recorded_by, date, status) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(student_id, subject_id, date) DO UPDATE SET status = excluded.status, recorded_by = excluded.recorded_by`,
        newId("att_"),
        e.studentId,
        input.classId,
        input.subjectId,
        actor.id,
        input.date,
        e.status,
      );
    }
    audit(db, actor.id, "attendance.record", "class", input.classId, { date: input.date, entries: input.entries.length });
  });
  // Attendance never changes XP or credits.
}

export function attendanceSheet(db: Db, actor: Actor, classId: string, subjectId: string, date: string) {
  assertTeacherOfClass(db, actor, classId, subjectId);
  return db.all<{ id: string; display_name: string; avatar_hue: number; status: string | null }>(
    `SELECT u.id, u.display_name, u.avatar_hue, a.status FROM class_memberships cm JOIN users u ON u.id = cm.user_id
     LEFT JOIN attendance a ON a.student_id = u.id AND a.subject_id = ? AND a.date = ?
     WHERE cm.class_id = ? AND u.role = 'student' AND u.active = 1 ORDER BY u.display_name`,
    subjectId,
    date,
    classId,
  );
}

export function createAssignment(
  db: Db,
  actor: Actor,
  input: { classId: string; subjectId: string; title: string; description: string; dueAt: string; origin?: "manual" | "ai_reviewed" },
) {
  assertCan(actor, "assignments.write");
  assertTeacherOfClass(db, actor, input.classId, input.subjectId);
  const title = input.title.trim();
  if (title.length < 3 || title.length > 140) throw invalid("Title must be 3–140 characters.");
  if (!input.description.trim()) throw invalid("Add instructions for students.");
  const due = new Date(input.dueAt);
  if (Number.isNaN(due.getTime())) throw invalid("Choose a valid due date.");
  const id = newId("asg_");
  db.tx(() => {
    db.run(
      `INSERT INTO assignments (id, class_id, subject_id, teacher_id, title, description, due_at, status, origin) VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?)`,
      id,
      input.classId,
      input.subjectId,
      actor.id,
      title,
      input.description.trim().slice(0, 5000),
      due.toISOString(),
      input.origin ?? "manual",
    );
    const students = db.all<{ user_id: string }>(
      `SELECT cm.user_id FROM class_memberships cm JOIN users u ON u.id = cm.user_id WHERE cm.class_id = ? AND u.role = 'student'`,
      input.classId,
    );
    for (const s of students) {
      notify(db, s.user_id, { category: "academic", title: `New homework: ${title}`, body: `Due ${due.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`, href: "/app/homework", dedupeKey: `asg:${id}` });
    }
  });
  return id;
}

export function teacherAssignments(db: Db, actor: Actor) {
  if (actor.role !== "teacher") throw forbidden();
  return db.all<{ id: string; title: string; due_at: string; class_name: string; class_id: string; subject_name: string; subject_color: string; submitted: number; students: number; origin: string }>(
    `SELECT a.id, a.title, a.due_at, c.name class_name, c.id class_id, s.name subject_name, s.color subject_color, a.origin,
            (SELECT COUNT(*) FROM submissions sub WHERE sub.assignment_id = a.id) submitted,
            (SELECT COUNT(*) FROM class_memberships cm JOIN users u ON u.id = cm.user_id WHERE cm.class_id = a.class_id AND u.role = 'student') students
     FROM assignments a JOIN classes c ON c.id = a.class_id JOIN subjects s ON s.id = a.subject_id
     WHERE a.teacher_id = ? ORDER BY a.due_at DESC`,
    actor.id,
  );
}

export function assignmentSubmissions(db: Db, actor: Actor, assignmentId: string) {
  const a = db.get<{ class_id: string; subject_id: string; teacher_id: string; title: string }>(
    `SELECT class_id, subject_id, teacher_id, title FROM assignments WHERE id = ?`,
    assignmentId,
  );
  if (!a) throw notFound();
  assertTeacherOfClass(db, actor, a.class_id, a.subject_id);
  return {
    title: a.title,
    rows: db.all<{ student_id: string; display_name: string; submission_id: string | null; submitted_at: string | null; status: string | null; body: string | null; file_name: string | null; feedback: string | null }>(
      `SELECT u.id student_id, u.display_name, sub.id submission_id, sub.submitted_at, sub.status, sub.body, sub.file_name, sub.feedback
       FROM class_memberships cm JOIN users u ON u.id = cm.user_id
       LEFT JOIN submissions sub ON sub.assignment_id = ? AND sub.student_id = u.id
       WHERE cm.class_id = ? AND u.role = 'student' ORDER BY sub.submitted_at IS NULL, u.display_name`,
      assignmentId,
      a.class_id,
    ),
  };
}

export function returnSubmission(db: Db, actor: Actor, submissionId: string, feedback: string) {
  const s = db.get<{ id: string; student_id: string; class_id: string; subject_id: string; title: string }>(
    `SELECT sub.id, sub.student_id, a.class_id, a.subject_id, a.title FROM submissions sub JOIN assignments a ON a.id = sub.assignment_id WHERE sub.id = ?`,
    submissionId,
  );
  if (!s) throw notFound();
  assertTeacherOfClass(db, actor, s.class_id, s.subject_id);
  const text = feedback.trim();
  if (!text) throw invalid("Write some feedback for the student.");
  db.run(`UPDATE submissions SET status = 'returned', feedback = ? WHERE id = ?`, text.slice(0, 4000), s.id);
  notify(db, s.student_id, { category: "academic", title: `Feedback on “${s.title}”`, body: text.slice(0, 120), href: "/app/homework", dedupeKey: `ret:${s.id}` });
}

export function postAnnouncement(db: Db, actor: Actor, input: { classId: string | null; title: string; body: string; pinned?: boolean }) {
  if (input.classId) {
    assertCan(actor, "announcements.write.class");
    if (!teacherClassIds(db, actor.id).includes(input.classId)) throw forbidden();
  } else {
    assertCan(actor, "announcements.write.school");
  }
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 3 || title.length > 140) throw invalid("Title must be 3–140 characters.");
  if (body.length < 3 || body.length > 4000) throw invalid("Message must be 3–4000 characters.");
  const id = newId("ann_");
  db.tx(() => {
    db.run(
      `INSERT INTO announcements (id, school_id, class_id, author_id, title, body, pinned) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      actor.schoolId,
      input.classId,
      actor.id,
      title,
      body,
      input.pinned ? 1 : 0,
    );
    const recipients = input.classId
      ? db.all<{ id: string }>(`SELECT u.id FROM class_memberships cm JOIN users u ON u.id = cm.user_id WHERE cm.class_id = ? AND u.role = 'student'`, input.classId)
      : db.all<{ id: string }>(`SELECT id FROM users WHERE school_id = ? AND id <> ? AND active = 1`, actor.schoolId, actor.id);
    for (const r of recipients) {
      notify(db, r.id, { category: "announcement", title, body: body.slice(0, 140), href: "/app/catalog?tab=announcements", dedupeKey: `ann:${id}` });
    }
  });
  return id;
}
