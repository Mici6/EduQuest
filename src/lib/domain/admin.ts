import type { Actor, Role } from "../auth/types";
import { ROLES } from "../auth/types";
import { assertCan } from "../auth/policy";
import { conflict, invalid, notFound } from "../auth/errors";
import type { Db } from "../db/client";
import { json, newId } from "../db/client";
import { addDays, isoDate } from "../utils/dates";
import { attendanceStats, weightedAverage } from "./catalog";
import { audit } from "./audit";
import { supportAggregates } from "./support";

export type SchoolSettings = {
  aiEnabledForStudents: boolean;
  aiDailyLimit: number;
  questsEnabled: boolean;
  leaderboardEnabled: boolean;
  supportRetentionMonths: number;
  studentUploadsEnabled: boolean;
  /** Money the school sets aside for course grants (whole currency units). */
  grantBudget: number;
  grantCurrency: string;
};

export const DEFAULT_SETTINGS: SchoolSettings = {
  aiEnabledForStudents: true,
  aiDailyLimit: 60,
  questsEnabled: true,
  leaderboardEnabled: false,
  supportRetentionMonths: 12,
  studentUploadsEnabled: true,
  grantBudget: 0,
  grantCurrency: "RON",
};

export function schoolSettings(db: Db, schoolId: string): SchoolSettings {
  const row = db.get<{ settings: string }>(`SELECT settings FROM schools WHERE id = ?`, schoolId);
  return { ...DEFAULT_SETTINGS, ...json<Partial<SchoolSettings>>(row?.settings, {}) };
}

export function updateSchoolSettings(db: Db, actor: Actor, patch: Partial<SchoolSettings>) {
  assertCan(actor, "school.manage");
  const next = { ...schoolSettings(db, actor.schoolId), ...patch };
  next.aiDailyLimit = Math.max(0, Math.min(500, Math.round(next.aiDailyLimit)));
  next.supportRetentionMonths = Math.max(1, Math.min(36, Math.round(next.supportRetentionMonths)));
  next.grantBudget = Math.max(0, Math.min(10_000_000, Math.round(Number(next.grantBudget) || 0)));
  next.grantCurrency = /^[A-Z]{3}$/.test(String(next.grantCurrency)) ? next.grantCurrency : "RON";
  db.run(`UPDATE schools SET settings = ? WHERE id = ?`, JSON.stringify(next), actor.schoolId);
  audit(db, actor.id, "school.settings.update", "school", actor.schoolId, Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v as string | number | boolean])));
  return next;
}

export function schoolOverview(db: Db, actor: Actor, now = new Date()) {
  assertCan(actor, "school.manage");
  const s = actor.schoolId;
  const counts = Object.fromEntries(
    ROLES.map((r) => [r, db.get<{ c: number }>(`SELECT COUNT(*) c FROM users WHERE school_id = ? AND role = ? AND active = 1`, s, r)!.c]),
  ) as Record<Role, number>;
  const since7 = addDays(now, -7).toISOString().replace("T", " ").slice(0, 19);
  const active7 = db.get<{ c: number }>(
    `SELECT COUNT(DISTINCT uid) c FROM (
       SELECT user_id uid FROM xp_transactions WHERE created_at >= ?
       UNION SELECT student_id FROM submissions WHERE submitted_at >= ?
       UNION SELECT user_id FROM ai_usage WHERE day >= ?
       UNION SELECT recorded_by FROM attendance WHERE date >= ?
       UNION SELECT teacher_id FROM grades WHERE created_at >= ?
     ) x JOIN users u ON u.id = x.uid WHERE u.school_id = ?`,
    since7,
    since7,
    isoDate(addDays(now, -7)),
    isoDate(addDays(now, -7)),
    since7,
    s,
  )!.c;

  const classes = db
    .all<{ id: string; name: string; grade_level: number; homeroom: string | null; students: number }>(
      `SELECT c.id, c.name, c.grade_level, u.display_name homeroom,
              (SELECT COUNT(*) FROM class_memberships cm JOIN users x ON x.id = cm.user_id WHERE cm.class_id = c.id AND x.role = 'student') students
       FROM classes c LEFT JOIN users u ON u.id = c.homeroom_teacher_id WHERE c.school_id = ? ORDER BY c.name`,
      s,
    )
    .map((c) => {
      const grades = db.all<{ value: number; weight: number }>(`SELECT value, weight FROM grades WHERE class_id = ?`, c.id);
      const att = db.all<{ status: string }>(`SELECT status FROM attendance WHERE class_id = ? AND date >= ?`, c.id, isoDate(addDays(now, -30)));
      return { ...c, average: weightedAverage(grades), attendance: attendanceStats(att).rate };
    });

  const att30 = attendanceStats(
    db.all<{ status: string }>(
      `SELECT a.status FROM attendance a JOIN users u ON u.id = a.student_id WHERE u.school_id = ? AND a.date >= ?`,
      s,
      isoDate(addDays(now, -30)),
    ),
  );

  const engagement = Array.from({ length: 14 }, (_, i) => {
    const day = isoDate(addDays(now, i - 13));
    const q = (sql: string) => db.get<{ c: number }>(sql, s, day)!.c;
    return {
      day,
      quizzes: q(`SELECT COUNT(*) c FROM quiz_attempts a JOIN users u ON u.id = a.student_id WHERE u.school_id = ? AND date(a.completed_at, 'localtime') = ?`),
      flashcards: q(`SELECT COUNT(*) c FROM xp_transactions x JOIN users u ON u.id = x.user_id WHERE u.school_id = ? AND x.source_type = 'flashcard' AND date(x.created_at, 'localtime') = ?`),
      homework: q(`SELECT COUNT(*) c FROM submissions x JOIN users u ON u.id = x.student_id WHERE u.school_id = ? AND date(x.submitted_at, 'localtime') = ?`),
    };
  });

  const credits = db.get<{ earned: number; spent: number }>(
    `SELECT COALESCE(SUM(CASE WHEN c.amount > 0 THEN c.amount END), 0) earned, COALESCE(-SUM(CASE WHEN c.amount < 0 THEN c.amount END), 0) spent
     FROM credit_transactions c JOIN users u ON u.id = c.user_id WHERE u.school_id = ?`,
    s,
  )!;
  const volunteering = db.get<{ activities: number; verified: number }>(
    `SELECT (SELECT COUNT(*) FROM volunteering_activities WHERE school_id = ?) activities,
            (SELECT COUNT(*) FROM volunteering_registrations r JOIN volunteering_activities a ON a.id = r.activity_id WHERE a.school_id = ? AND r.status = 'verified') verified`,
    s,
    s,
  )!;
  const aiToday = db.get<{ c: number }>(
    `SELECT COALESCE(SUM(requests), 0) c FROM ai_usage a JOIN users u ON u.id = a.user_id WHERE u.school_id = ? AND a.day = ?`,
    s,
    isoDate(now),
  )!.c;
  const documents = db.get<{ c: number }>(`SELECT COUNT(*) c FROM documents WHERE school_id = ? AND status = 'indexed'`, s)!.c;

  return { counts, active7, classes, attendance: att30, engagement, credits, volunteering, aiToday, documents, support: supportAggregates(db, s) };
}

export function listPeople(db: Db, actor: Actor, opts: { role?: string; q?: string } = {}) {
  assertCan(actor, "school.manage");
  const where = ["u.school_id = ?"];
  const params: string[] = [actor.schoolId];
  if (opts.role && (ROLES as readonly string[]).includes(opts.role)) {
    where.push("u.role = ?");
    params.push(opts.role);
  }
  if (opts.q?.trim()) {
    where.push("(u.display_name LIKE ? OR u.email LIKE ?)");
    params.push(`%${opts.q.trim()}%`, `%${opts.q.trim()}%`);
  }
  return db.all<{ id: string; display_name: string; email: string; role: Role; active: number; avatar_hue: number; title: string | null; classes: string | null }>(
    `SELECT u.id, u.display_name, u.email, u.role, u.active, u.avatar_hue, u.title,
            (SELECT GROUP_CONCAT(c.name, ', ') FROM class_memberships cm JOIN classes c ON c.id = cm.class_id WHERE cm.user_id = u.id) classes
     FROM users u WHERE ${where.join(" AND ")} ORDER BY u.role, u.display_name`,
    ...params,
  );
}

export function createPerson(db: Db, actor: Actor, input: { name: string; email: string; role: Role; classId?: string | null }) {
  assertCan(actor, "school.manage");
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 2 || name.length > 80) throw invalid("Enter a name (2–80 characters).");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalid("Enter a valid email address.");
  if (!(ROLES as readonly string[]).includes(input.role)) throw invalid("Unknown role.");
  if (db.get(`SELECT 1 FROM users WHERE email = ?`, email)) throw conflict("A user with that email already exists.");
  if (input.classId && !db.get(`SELECT 1 FROM classes WHERE id = ? AND school_id = ?`, input.classId, actor.schoolId)) throw invalid("Unknown class.");
  const id = newId("usr_");
  db.tx(() => {
    db.run(
      `INSERT INTO users (id, school_id, role, display_name, email, avatar_hue, is_demo) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      id,
      actor.schoolId,
      input.role,
      name,
      email,
      Math.floor(Math.random() * 360),
    );
    if (input.classId) db.run(`INSERT INTO class_memberships (class_id, user_id) VALUES (?, ?)`, input.classId, id);
    audit(db, actor.id, "people.create", "user", id, { role: input.role });
  });
  return id;
}

export function setUserActive(db: Db, actor: Actor, userId: string, active: boolean) {
  assertCan(actor, "school.manage");
  if (userId === actor.id) throw conflict("You can't deactivate your own account.");
  const res = db.run(`UPDATE users SET active = ? WHERE id = ? AND school_id = ?`, active ? 1 : 0, userId, actor.schoolId);
  if (Number(res.changes) === 0) throw notFound();
  audit(db, actor.id, active ? "people.activate" : "people.deactivate", "user", userId);
}

export function createClass(db: Db, actor: Actor, input: { name: string; gradeLevel: number; homeroomTeacherId?: string | null }) {
  assertCan(actor, "school.manage");
  const name = input.name.trim();
  if (!name || name.length > 40) throw invalid("Enter a class name.");
  if (!Number.isInteger(input.gradeLevel) || input.gradeLevel < 5 || input.gradeLevel > 13) throw invalid("Grade level must be 5–13.");
  if (input.homeroomTeacherId && !db.get(`SELECT 1 FROM users WHERE id = ? AND role = 'teacher' AND school_id = ?`, input.homeroomTeacherId, actor.schoolId)) throw invalid("Unknown teacher.");
  const id = newId("cls_");
  const year = new Date().getMonth() >= 8 ? `${new Date().getFullYear()}/${new Date().getFullYear() + 1}` : `${new Date().getFullYear() - 1}/${new Date().getFullYear()}`;
  db.run(`INSERT INTO classes (id, school_id, name, grade_level, homeroom_teacher_id, academic_year) VALUES (?, ?, ?, ?, ?, ?)`, id, actor.schoolId, name, input.gradeLevel, input.homeroomTeacherId ?? null, year);
  audit(db, actor.id, "classes.create", "class", id);
  return id;
}

export function createSubject(db: Db, actor: Actor, input: { name: string; short: string; color: string }) {
  assertCan(actor, "school.manage");
  const name = input.name.trim();
  const short = input.short.trim().toUpperCase().slice(0, 4);
  if (!name || !short) throw invalid("Enter a subject name and short code.");
  if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) throw invalid("Choose a colour.");
  const id = newId("sub_");
  db.run(`INSERT INTO subjects (id, school_id, name, short, color, icon) VALUES (?, ?, ?, ?, ?, 'book')`, id, actor.schoolId, name, short, input.color);
  audit(db, actor.id, "subjects.create", "subject", id);
  return id;
}

export function assignTeacher(db: Db, actor: Actor, input: { teacherId: string; classId: string; subjectId: string }) {
  assertCan(actor, "school.manage");
  const ok =
    db.get(`SELECT 1 FROM users WHERE id = ? AND role = 'teacher' AND school_id = ?`, input.teacherId, actor.schoolId) &&
    db.get(`SELECT 1 FROM classes WHERE id = ? AND school_id = ?`, input.classId, actor.schoolId) &&
    db.get(`SELECT 1 FROM subjects WHERE id = ? AND school_id = ?`, input.subjectId, actor.schoolId);
  if (!ok) throw invalid("Choose a teacher, class and subject from this school.");
  db.run(`INSERT OR IGNORE INTO teaching_assignments (teacher_id, class_id, subject_id) VALUES (?, ?, ?)`, input.teacherId, input.classId, input.subjectId);
  audit(db, actor.id, "teaching.assign", "class", input.classId, { subjectId: input.subjectId });
}

export function teachingMatrix(db: Db, actor: Actor) {
  assertCan(actor, "school.manage");
  return db.all<{ class_id: string; class_name: string; subject_name: string; subject_color: string; teacher_name: string }>(
    `SELECT c.id class_id, c.name class_name, s.name subject_name, s.color subject_color, u.display_name teacher_name
     FROM teaching_assignments ta JOIN classes c ON c.id = ta.class_id JOIN subjects s ON s.id = ta.subject_id JOIN users u ON u.id = ta.teacher_id
     WHERE c.school_id = ? ORDER BY c.name, s.name`,
    actor.schoolId,
  );
}

export function auditLog(db: Db, actor: Actor, limit = 100) {
  assertCan(actor, "audit.read");
  return db.all<{ id: string; action: string; resource_type: string; resource_id: string | null; metadata: string; created_at: string; actor_name: string | null; actor_role: string | null }>(
    `SELECT a.id, a.action, a.resource_type, a.resource_id, a.metadata, a.created_at, u.display_name actor_name, u.role actor_role
     FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
     WHERE u.school_id = ? OR a.actor_id IS NULL ORDER BY a.created_at DESC, a.rowid DESC LIMIT ?`,
    actor.schoolId,
    limit,
  );
}

export function subscriptionInfo(db: Db, actor: Actor) {
  assertCan(actor, "school.manage");
  const plans = db.all<{ id: string; code: string; name: string; audience: string; description: string; features: string; price_minor: number | null; currency: string | null; interval: string | null; ai_daily_requests: number }>(
    `SELECT * FROM subscription_plans ORDER BY CASE audience WHEN 'school' THEN 0 WHEN 'student_standard' THEN 1 ELSE 2 END`,
  ).map((p) => ({ ...p, features: json<string[]>(p.features, []) }));
  const current = db.get<{ plan_id: string; status: string; seats: number; starts_on: string; ends_on: string | null }>(
    `SELECT plan_id, status, seats, starts_on, ends_on FROM school_subscriptions WHERE school_id = ?`,
    actor.schoolId,
  );
  return { plans, current };
}

export function allClasses(db: Db, schoolId: string) {
  return db.all<{ id: string; name: string; grade_level: number }>(`SELECT id, name, grade_level FROM classes WHERE school_id = ? ORDER BY name`, schoolId);
}

export function allTeachers(db: Db, schoolId: string) {
  return db.all<{ id: string; display_name: string }>(`SELECT id, display_name FROM users WHERE school_id = ? AND role = 'teacher' AND active = 1 ORDER BY display_name`, schoolId);
}
