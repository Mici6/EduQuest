import type { Db } from "../db/client";
import { forbidden } from "./errors";
import type { Actor, Role } from "./types";

/**
 * Role-based permissions. Scope checks (which student, which class) live in
 * the scope helpers below and are enforced inside every domain function,
 * so hiding a button is never the only line of defence.
 */
export const PERMISSIONS = {
  "catalog.read.self": ["student"],
  "catalog.read.class": ["teacher"],
  "catalog.read.school": ["admin"],
  "study.use": ["student", "teacher"],
  "homework.submit": ["student"],
  "quiz.attempt": ["student"],
  "volunteering.register": ["student"],
  "volunteering.organize": ["teacher", "admin"],
  "courses.unlock": ["student"],
  "documents.upload.private": ["student"],
  "documents.upload.class": ["teacher", "admin"],
  "grades.write": ["teacher"],
  "attendance.write": ["teacher"],
  "assignments.write": ["teacher"],
  "content.generate": ["teacher"],
  "content.publish": ["teacher"],
  "announcements.write.class": ["teacher"],
  "announcements.write.school": ["admin"],
  "school.manage": ["admin"],
  "audit.read": ["admin"],
  "support.access": ["support"],
  "gamification.earn": ["student"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(actor: Actor, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(actor.role);
}

export function assertCan(actor: Actor, permission: Permission): void {
  if (!can(actor, permission)) throw forbidden();
}

/** Classes a teacher teaches (any subject) or is homeroom teacher of. */
export function teacherClassIds(db: Db, teacherId: string): string[] {
  return db
    .all<{ class_id: string }>(
      `SELECT DISTINCT class_id FROM teaching_assignments WHERE teacher_id = ?
       UNION SELECT id FROM classes WHERE homeroom_teacher_id = ?`,
      teacherId,
      teacherId,
    )
    .map((r) => r.class_id);
}

export function teacherTeaches(db: Db, teacherId: string, classId: string, subjectId?: string): boolean {
  const row = subjectId
    ? db.get(`SELECT 1 FROM teaching_assignments WHERE teacher_id = ? AND class_id = ? AND subject_id = ?`, teacherId, classId, subjectId)
    : db.get(`SELECT 1 FROM teaching_assignments WHERE teacher_id = ? AND class_id = ?`, teacherId, classId);
  return !!row;
}

export function studentClassIds(db: Db, studentId: string): string[] {
  return db
    .all<{ class_id: string }>(
      `SELECT cm.class_id FROM class_memberships cm JOIN users u ON u.id = cm.user_id WHERE cm.user_id = ? AND u.role = 'student'`,
      studentId,
    )
    .map((r) => r.class_id);
}

function sameSchool(db: Db, actor: Actor, userId: string): boolean {
  const row = db.get<{ school_id: string }>(`SELECT school_id FROM users WHERE id = ?`, userId);
  return !!row && row.school_id === actor.schoolId;
}

/**
 * Academic records (grades, attendance, homework). Students see only
 * themselves; teachers see students in classes they teach; admins see
 * their school. Support staff see their assigned caseload only.
 */
export function canReadAcademicRecord(db: Db, actor: Actor, studentId: string): boolean {
  switch (actor.role) {
    case "student":
      return actor.id === studentId;
    case "teacher": {
      const mine = new Set(teacherClassIds(db, actor.id));
      return studentClassIds(db, studentId).some((c) => mine.has(c));
    }
    case "admin":
      return sameSchool(db, actor, studentId);
    case "support":
      return inCaseload(db, actor.id, studentId);
  }
}

export function assertAcademicRecord(db: Db, actor: Actor, studentId: string) {
  if (!canReadAcademicRecord(db, actor, studentId)) throw forbidden();
}

export function inCaseload(db: Db, staffId: string, studentId: string): boolean {
  return !!db.get(`SELECT 1 FROM support_caseload WHERE staff_id = ? AND student_id = ?`, staffId, studentId);
}

/**
 * Student-support records (indicators, reviews, plans, notes) are restricted
 * to support staff, and only for students on their caseload. Teachers and
 * administrators do not gain access by virtue of their role.
 */
export function assertSupportAccess(db: Db, actor: Actor, studentId: string) {
  if (actor.role !== "support" || !inCaseload(db, actor.id, studentId)) throw forbidden();
}

export function assertTeacherOfClass(db: Db, actor: Actor, classId: string, subjectId?: string) {
  if (actor.role !== "teacher" || !teacherTeaches(db, actor.id, classId, subjectId)) throw forbidden();
}
