import type { Actor } from "../auth/types";
import { assertSupportAccess, inCaseload } from "../auth/policy";
import { conflict, forbidden, invalid, notFound } from "../auth/errors";
import type { Db } from "../db/client";
import { json, newId } from "../db/client";
import { addDays, isoDate, isoWeekKey, toDate } from "../utils/dates";
import { attendanceStats, weightedAverage } from "./catalog";
import { audit } from "./audit";

/**
 * Student-support module.
 *
 * Indicators are produced by transparent, rule-based pattern detection
 * ("rules-v1"). They are prompts for human review — not diagnoses, labels
 * or predictions. Nothing here changes grades, XP, credits or access, and
 * no decision is taken without a named staff member's review.
 *
 * Access is limited to support staff, for students on their caseload.
 * Every read of an individual record is audit-logged.
 */

export const DETECTOR = "rules-v1";

export type IndicatorKind = "grade_decline" | "missing_assignments" | "attendance_change" | "engagement_drop";

export const INDICATOR_LABEL: Record<IndicatorKind, string> = {
  grade_decline: "Change in recent grades",
  missing_assignments: "Several assignments not submitted",
  attendance_change: "Change in attendance",
  engagement_drop: "Less learning activity than usual",
};

type Evidence = { label: string; before?: string; after?: string; value?: string }[];

type Candidate = { studentId: string; kind: IndicatorKind; strength: "low" | "moderate" | "notable"; summary: string; evidence: Evidence };

function detectForStudent(db: Db, studentId: string, now: Date): Candidate[] {
  const out: Candidate[] = [];
  const recentStart = isoDate(addDays(now, -28));
  const prevStart = isoDate(addDays(now, -56));

  // 1) Grades: compare the last 4 weeks with the 4 weeks before, per subject.
  const grades = db.all<{ subject: string; value: number; weight: number; graded_on: string }>(
    `SELECT s.name subject, g.value, g.weight, g.graded_on FROM grades g JOIN subjects s ON s.id = g.subject_id
     WHERE g.student_id = ? AND g.graded_on >= ?`,
    studentId,
    prevStart,
  );
  const bySubject = new Map<string, typeof grades>();
  for (const g of grades) bySubject.set(g.subject, [...(bySubject.get(g.subject) ?? []), g]);
  const declines: { subject: string; before: number; after: number }[] = [];
  for (const [subject, gs] of bySubject) {
    const before = weightedAverage(gs.filter((g) => g.graded_on < recentStart));
    const after = weightedAverage(gs.filter((g) => g.graded_on >= recentStart));
    if (before != null && after != null && before - after >= 1.5) declines.push({ subject, before, after });
  }
  if (declines.length) {
    const maxDrop = Math.max(...declines.map((d) => d.before - d.after));
    out.push({
      studentId,
      kind: "grade_decline",
      strength: maxDrop >= 2.5 || declines.length >= 3 ? "notable" : declines.length >= 2 ? "moderate" : "low",
      summary: `Recent grades are lower than the previous four weeks in ${declines.map((d) => d.subject).join(", ")}.`,
      evidence: declines.map((d) => ({ label: d.subject, before: d.before.toFixed(2), after: d.after.toFixed(2) })),
    });
  }

  // 2) Missing assignments due in the last 4 weeks.
  const missing = db.all<{ title: string; subject: string; due_at: string }>(
    `SELECT a.title, s.name subject, a.due_at FROM assignments a JOIN subjects s ON s.id = a.subject_id
     JOIN class_memberships cm ON cm.class_id = a.class_id AND cm.user_id = ?
     LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = ?
     WHERE a.status = 'published' AND sub.id IS NULL AND a.due_at < ? AND a.due_at >= ?`,
    studentId,
    studentId,
    now.toISOString(),
    addDays(now, -28).toISOString(),
  );
  if (missing.length >= 3) {
    out.push({
      studentId,
      kind: "missing_assignments",
      strength: missing.length >= 5 ? "notable" : "moderate",
      summary: `${missing.length} assignments due in the last four weeks have no submission.`,
      evidence: missing.slice(0, 6).map((m) => ({ label: `${m.subject}: ${m.title}`, value: `due ${isoDate(toDate(m.due_at))}` })),
    });
  }

  // 3) Attendance: rate change between the two periods.
  const att = db.all<{ status: string; date: string }>(`SELECT status, date FROM attendance WHERE student_id = ? AND date >= ?`, studentId, prevStart);
  const before = attendanceStats(att.filter((a) => a.date < recentStart)).rate;
  const after = attendanceStats(att.filter((a) => a.date >= recentStart)).rate;
  if (before != null && after != null && before - after >= 12 && after < 88) {
    out.push({
      studentId,
      kind: "attendance_change",
      strength: before - after >= 25 ? "notable" : "moderate",
      summary: `Attendance over the last four weeks is lower than the previous four weeks.`,
      evidence: [{ label: "Attendance rate", before: `${before}%`, after: `${after}%` }],
    });
  }

  // 4) Engagement: active learning days in the last 14 vs the previous 14.
  const days = db.all<{ d: string }>(
    `SELECT DISTINCT date(completed_at, 'localtime') d FROM quiz_attempts WHERE student_id = ?
     UNION SELECT DISTINCT day FROM study_sessions WHERE user_id = ?
     UNION SELECT DISTINCT date(submitted_at, 'localtime') FROM submissions WHERE student_id = ?`,
    studentId,
    studentId,
    studentId,
  ).map((r) => r.d);
  const r14 = isoDate(addDays(now, -14));
  const p28 = isoDate(addDays(now, -28));
  const recent = days.filter((d) => d >= r14).length;
  const prev = days.filter((d) => d >= p28 && d < r14).length;
  if (prev >= 4 && recent <= prev * 0.4) {
    out.push({
      studentId,
      kind: "engagement_drop",
      strength: recent === 0 ? "moderate" : "low",
      summary: `Fewer days with study activity in the last two weeks than in the two weeks before.`,
      evidence: [{ label: "Days with study activity", before: String(prev), after: String(recent) }],
    });
  }
  return out;
}

/** Run detection for a school. Creates at most one indicator per kind/student/week. */
export function runDetection(db: Db, schoolId: string, now = new Date()) {
  const students = db.all<{ id: string }>(`SELECT id FROM users WHERE school_id = ? AND role = 'student' AND active = 1`, schoolId);
  const week = isoWeekKey(now);
  let created = 0;
  db.tx(() => {
    for (const s of students) {
      for (const c of detectForStudent(db, s.id, now)) {
        // Skip if there is already an open indicator of this kind for the student.
        const open = db.get(`SELECT 1 FROM support_indicators WHERE student_id = ? AND kind = ? AND status IN ('pending_review','confirmed')`, s.id, c.kind);
        if (open) continue;
        const res = db.run(
          `INSERT INTO support_indicators (id, student_id, kind, strength, summary, evidence, detector, fingerprint) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(fingerprint) DO NOTHING`,
          newId("ind_"),
          s.id,
          c.kind,
          c.strength,
          c.summary,
          JSON.stringify(c.evidence),
          DETECTOR,
          `${c.kind}:${s.id}:${week}`,
        );
        created += Number(res.changes);
      }
    }
  });
  return created;
}

export function triggerDetection(db: Db, actor: Actor, now = new Date()) {
  if (actor.role !== "support") throw forbidden();
  const created = runDetection(db, actor.schoolId, now);
  audit(db, actor.id, "support.detection.run", "school", actor.schoolId, { created });
  return created;
}

function requireSupport(actor: Actor) {
  if (actor.role !== "support") throw forbidden();
}

export function supportQueue(db: Db, actor: Actor) {
  requireSupport(actor);
  return db.all<{ id: string; student_id: string; student_name: string; class_name: string | null; kind: IndicatorKind; strength: string; summary: string; status: string; detected_at: string }>(
    `SELECT i.id, i.student_id, u.display_name student_name,
            (SELECT c.name FROM class_memberships cm JOIN classes c ON c.id = cm.class_id WHERE cm.user_id = u.id LIMIT 1) class_name,
            i.kind, i.strength, i.summary, i.status, i.detected_at
     FROM support_indicators i JOIN users u ON u.id = i.student_id
     JOIN support_caseload sc ON sc.student_id = i.student_id AND sc.staff_id = ?
     ORDER BY CASE i.status WHEN 'pending_review' THEN 0 WHEN 'confirmed' THEN 1 ELSE 2 END,
              CASE i.strength WHEN 'notable' THEN 0 WHEN 'moderate' THEN 1 ELSE 2 END, i.detected_at DESC`,
    actor.id,
  );
}

export function caseload(db: Db, actor: Actor) {
  requireSupport(actor);
  return db.all<{ id: string; display_name: string; avatar_hue: number; class_name: string | null; open_indicators: number; active_plans: number }>(
    `SELECT u.id, u.display_name, u.avatar_hue,
            (SELECT c.name FROM class_memberships cm JOIN classes c ON c.id = cm.class_id WHERE cm.user_id = u.id LIMIT 1) class_name,
            (SELECT COUNT(*) FROM support_indicators i WHERE i.student_id = u.id AND i.status = 'pending_review') open_indicators,
            (SELECT COUNT(*) FROM intervention_plans p WHERE p.student_id = u.id AND p.status <> 'closed') active_plans
     FROM support_caseload sc JOIN users u ON u.id = sc.student_id WHERE sc.staff_id = ? ORDER BY open_indicators DESC, active_plans DESC, u.display_name`,
    actor.id,
  );
}

/** Data-minimised academic snapshot for support staff. */
function snapshot(db: Db, studentId: string, now: Date) {
  const since = isoDate(addDays(now, -56));
  const grades = db.all<{ subject: string; value: number; weight: number; graded_on: string }>(
    `SELECT s.name subject, g.value, g.weight, g.graded_on FROM grades g JOIN subjects s ON s.id = g.subject_id WHERE g.student_id = ? AND g.graded_on >= ? ORDER BY g.graded_on`,
    studentId,
    since,
  );
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = isoDate(addDays(now, -56 + i * 7));
    const end = isoDate(addDays(now, -49 + i * 7));
    const g = grades.filter((x) => x.graded_on >= start && x.graded_on < end);
    const att = db.all<{ status: string }>(`SELECT status FROM attendance WHERE student_id = ? AND date >= ? AND date < ?`, studentId, start, end);
    return { label: `W${i + 1}`, start, average: weightedAverage(g), attendance: attendanceStats(att).rate };
  });
  return { weeks };
}

export function indicatorDetail(db: Db, actor: Actor, id: string, now = new Date()) {
  requireSupport(actor);
  const ind = db.get<{ id: string; student_id: string; kind: IndicatorKind; strength: string; summary: string; evidence: string; status: string; detected_at: string; detector: string }>(
    `SELECT id, student_id, kind, strength, summary, evidence, status, detected_at, detector FROM support_indicators WHERE id = ?`,
    id,
  );
  if (!ind) throw notFound();
  assertSupportAccess(db, actor, ind.student_id);
  audit(db, actor.id, "support.indicator.view", "support_indicator", id);
  const student = db.get<{ id: string; display_name: string; avatar_hue: number; grade_level: number | null }>(
    `SELECT id, display_name, avatar_hue, grade_level FROM users WHERE id = ?`,
    ind.student_id,
  )!;
  const reviews = db.all<{ id: string; decision: string; rationale: string; created_at: string; reviewer_name: string }>(
    `SELECT r.id, r.decision, r.rationale, r.created_at, u.display_name reviewer_name FROM support_reviews r JOIN users u ON u.id = r.reviewer_id WHERE r.indicator_id = ? ORDER BY r.created_at`,
    id,
  );
  const plans = db.all<{ id: string; status: string; goals: string; review_on: string; created_at: string }>(
    `SELECT id, status, goals, review_on, created_at FROM intervention_plans WHERE indicator_id = ? ORDER BY created_at DESC`,
    id,
  );
  return { indicator: { ...ind, evidence: json<Evidence>(ind.evidence, []) }, student, reviews, plans, snapshot: snapshot(db, ind.student_id, now) };
}

export function reviewIndicator(db: Db, actor: Actor, id: string, decision: "confirmed" | "dismissed", rationale: string) {
  requireSupport(actor);
  const ind = db.get<{ student_id: string; status: string }>(`SELECT student_id, status FROM support_indicators WHERE id = ?`, id);
  if (!ind) throw notFound();
  assertSupportAccess(db, actor, ind.student_id);
  if (ind.status !== "pending_review") throw conflict("This indicator has already been reviewed.");
  const text = rationale.trim();
  if (text.length < 10) throw invalid("Record a short rationale for your decision (at least 10 characters).");
  db.tx(() => {
    db.run(`INSERT INTO support_reviews (id, indicator_id, reviewer_id, decision, rationale) VALUES (?, ?, ?, ?, ?)`, newId("rev_"), id, actor.id, decision, text.slice(0, 2000));
    db.run(`UPDATE support_indicators SET status = ? WHERE id = ?`, decision, id);
    audit(db, actor.id, `support.indicator.${decision}`, "support_indicator", id);
  });
}

export function createPlan(
  db: Db,
  actor: Actor,
  input: { studentId: string; indicatorId?: string | null; goals: string; actions: string; reviewOn: string },
  now = new Date(),
) {
  requireSupport(actor);
  assertSupportAccess(db, actor, input.studentId);
  if (input.indicatorId) {
    const ind = db.get<{ student_id: string; status: string }>(`SELECT student_id, status FROM support_indicators WHERE id = ?`, input.indicatorId);
    if (!ind || ind.student_id !== input.studentId) throw invalid("Indicator does not belong to this student.");
    if (ind.status !== "confirmed") throw conflict("Confirm the indicator after review before creating a support plan.");
  }
  if (input.goals.trim().length < 10) throw invalid("Describe the goals of the plan.");
  if (input.actions.trim().length < 10) throw invalid("Describe the supportive actions agreed.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.reviewOn) || input.reviewOn < isoDate(now)) throw invalid("Choose a review date in the future.");
  const settings = json<{ supportRetentionMonths?: number }>(db.get<{ settings: string }>(`SELECT settings FROM schools WHERE id = ?`, actor.schoolId)?.settings, {});
  const retain = new Date(now);
  retain.setMonth(retain.getMonth() + (settings.supportRetentionMonths ?? 12));
  const id = newId("pln_");
  db.run(
    `INSERT INTO intervention_plans (id, student_id, indicator_id, owner_id, goals, actions, review_on, retain_until) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.studentId,
    input.indicatorId ?? null,
    actor.id,
    input.goals.trim().slice(0, 3000),
    input.actions.trim().slice(0, 3000),
    input.reviewOn,
    isoDate(retain),
  );
  audit(db, actor.id, "support.plan.create", "intervention_plan", id);
  return id;
}

export function planDetail(db: Db, actor: Actor, id: string, now = new Date()) {
  requireSupport(actor);
  const plan = db.get<{ id: string; student_id: string; indicator_id: string | null; goals: string; actions: string; status: string; review_on: string; retain_until: string; created_at: string; owner_name: string }>(
    `SELECT p.*, u.display_name owner_name FROM intervention_plans p JOIN users u ON u.id = p.owner_id WHERE p.id = ?`,
    id,
  );
  if (!plan) throw notFound();
  assertSupportAccess(db, actor, plan.student_id);
  audit(db, actor.id, "support.plan.view", "intervention_plan", id);
  const notes = db.all<{ id: string; kind: string; body: string; created_at: string; author_name: string }>(
    `SELECT n.id, n.kind, n.body, n.created_at, u.display_name author_name FROM intervention_notes n JOIN users u ON u.id = n.author_id WHERE n.plan_id = ? ORDER BY n.created_at DESC`,
    id,
  );
  const student = db.get<{ id: string; display_name: string; avatar_hue: number }>(`SELECT id, display_name, avatar_hue FROM users WHERE id = ?`, plan.student_id)!;
  // Progress review: compare equal windows before and after the plan started.
  const start = toDate(plan.created_at);
  const span = Math.max(14, Math.min(42, Math.round((now.getTime() - start.getTime()) / 86400000)));
  const beforeFrom = isoDate(addDays(start, -span));
  const startIso = isoDate(start);
  const g = (from: string, to: string) =>
    weightedAverage(db.all<{ value: number; weight: number }>(`SELECT value, weight FROM grades WHERE student_id = ? AND graded_on >= ? AND graded_on < ?`, plan.student_id, from, to));
  const a = (from: string, to: string) =>
    attendanceStats(db.all<{ status: string }>(`SELECT status FROM attendance WHERE student_id = ? AND date >= ? AND date < ?`, plan.student_id, from, to)).rate;
  const today = isoDate(addDays(now, 1));
  const progress = {
    windowDays: span,
    grades: { before: g(beforeFrom, startIso), after: g(startIso, today) },
    attendance: { before: a(beforeFrom, startIso), after: a(startIso, today) },
  };
  return { plan, notes, student, progress, snapshot: snapshot(db, plan.student_id, now) };
}

export function addPlanNote(db: Db, actor: Actor, planId: string, kind: "note" | "follow_up" | "progress_review", body: string) {
  requireSupport(actor);
  const plan = db.get<{ student_id: string }>(`SELECT student_id FROM intervention_plans WHERE id = ?`, planId);
  if (!plan) throw notFound();
  assertSupportAccess(db, actor, plan.student_id);
  const text = body.trim();
  if (text.length < 3) throw invalid("Write a note first.");
  if (!["note", "follow_up", "progress_review"].includes(kind)) throw invalid("Unknown note type.");
  db.run(`INSERT INTO intervention_notes (id, plan_id, author_id, kind, body) VALUES (?, ?, ?, ?, ?)`, newId("nte_"), planId, actor.id, kind, text.slice(0, 4000));
  audit(db, actor.id, "support.note.create", "intervention_plan", planId, { kind });
}

export function setPlanStatus(db: Db, actor: Actor, planId: string, status: "active" | "monitoring" | "closed") {
  requireSupport(actor);
  const plan = db.get<{ student_id: string; indicator_id: string | null }>(`SELECT student_id, indicator_id FROM intervention_plans WHERE id = ?`, planId);
  if (!plan) throw notFound();
  assertSupportAccess(db, actor, plan.student_id);
  db.tx(() => {
    db.run(`UPDATE intervention_plans SET status = ? WHERE id = ?`, status, planId);
    if (status === "closed" && plan.indicator_id) db.run(`UPDATE support_indicators SET status = 'resolved' WHERE id = ? AND status = 'confirmed'`, plan.indicator_id);
    audit(db, actor.id, "support.plan.status", "intervention_plan", planId, { status });
  });
}

export function plansFor(db: Db, actor: Actor) {
  requireSupport(actor);
  return db.all<{ id: string; student_id: string; student_name: string; status: string; review_on: string; goals: string; created_at: string; notes: number }>(
    `SELECT p.id, p.student_id, u.display_name student_name, p.status, p.review_on, p.goals, p.created_at,
            (SELECT COUNT(*) FROM intervention_notes n WHERE n.plan_id = p.id) notes
     FROM intervention_plans p JOIN users u ON u.id = p.student_id
     JOIN support_caseload sc ON sc.student_id = p.student_id AND sc.staff_id = ?
     ORDER BY p.status = 'closed', p.review_on`,
    actor.id,
  );
}

/** Aggregate counts only — used where identities must not be shown (e.g. admin dashboard). */
export function supportAggregates(db: Db, schoolId: string) {
  const row = db.get<{ pending: number; confirmed: number; plans: number; dismissed: number }>(
    `SELECT
       (SELECT COUNT(*) FROM support_indicators i JOIN users u ON u.id = i.student_id WHERE u.school_id = ? AND i.status = 'pending_review') pending,
       (SELECT COUNT(*) FROM support_indicators i JOIN users u ON u.id = i.student_id WHERE u.school_id = ? AND i.status = 'confirmed') confirmed,
       (SELECT COUNT(*) FROM support_indicators i JOIN users u ON u.id = i.student_id WHERE u.school_id = ? AND i.status = 'dismissed') dismissed,
       (SELECT COUNT(*) FROM intervention_plans p JOIN users u ON u.id = p.student_id WHERE u.school_id = ? AND p.status <> 'closed') plans`,
    schoolId,
    schoolId,
    schoolId,
    schoolId,
  )!;
  return row;
}

export { inCaseload };
