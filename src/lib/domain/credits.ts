import type { Actor } from "../auth/types";
import { assertCan } from "../auth/policy";
import { conflict, forbidden, invalid, notFound } from "../auth/errors";
import type { Db } from "../db/client";
import { newId } from "../db/client";
import { toDate } from "../utils/dates";
import { audit } from "./audit";
import { evaluateAchievements, recordProgress } from "./gamification";
import { notify } from "./notifications";

/**
 * Credits are a reward currency earned only through verified, approved
 * activities (volunteering, civic and school projects) and spent only on
 * mini-courses the student chooses to unlock.
 *
 * There is deliberately NO function for deducting credits for absences,
 * grades, behaviour or discipline, and the database CHECK constraint on
 * `credit_transactions` rejects any debit that is not a mini-course unlock.
 */

export function creditBalance(db: Db, userId: string): number {
  return db.get<{ s: number }>(`SELECT COALESCE(SUM(amount), 0) s FROM credit_transactions WHERE user_id = ?`, userId)!.s;
}

export function creditSummary(db: Db, userId: string) {
  const r = db.get<{ earned: number; spent: number }>(
    `SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount END), 0) earned,
            COALESCE(-SUM(CASE WHEN amount < 0 THEN amount END), 0) spent
     FROM credit_transactions WHERE user_id = ?`,
    userId,
  )!;
  return { balance: r.earned - r.spent, earned: r.earned, spent: r.spent };
}

export function creditHistory(db: Db, userId: string, limit = 50) {
  return db.all<{ id: string; amount: number; kind: string; reason: string; created_at: string }>(
    `SELECT id, amount, kind, reason, created_at FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`,
    userId,
    limit,
  );
}

// ── Volunteering ───────────────────────────────────────────────────────────────

export type ActivityView = {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  starts_at: string;
  duration_minutes: number;
  capacity: number;
  credits: number;
  status: string;
  organizer_name: string;
  organizer_id: string;
  taken: number;
  my_status: string | null;
  my_registration_id: string | null;
};

export function listActivities(db: Db, actor: Actor): ActivityView[] {
  return db.all<ActivityView>(
    `SELECT a.id, a.title, a.description, a.category, a.location, a.starts_at, a.duration_minutes, a.capacity, a.credits, a.status,
            u.display_name organizer_name, a.organizer_id,
            (SELECT COUNT(*) FROM volunteering_registrations r WHERE r.activity_id = a.id AND r.status IN ('registered','verified')) taken,
            mine.status my_status, mine.id my_registration_id
     FROM volunteering_activities a
     JOIN users u ON u.id = a.organizer_id
     LEFT JOIN volunteering_registrations mine ON mine.activity_id = a.id AND mine.student_id = ?
     WHERE a.school_id = ? AND a.status <> 'draft'
     ORDER BY a.starts_at`,
    actor.id,
    actor.schoolId,
  );
}

export function registerForActivity(db: Db, actor: Actor, activityId: string, now = new Date()) {
  assertCan(actor, "volunteering.register");
  return db.tx(() => {
    const a = db.get<{ id: string; school_id: string; capacity: number; status: string; starts_at: string; title: string }>(
      `SELECT id, school_id, capacity, status, starts_at, title FROM volunteering_activities WHERE id = ?`,
      activityId,
    );
    if (!a || a.school_id !== actor.schoolId) throw notFound("Activity not found.");
    if (a.status !== "open") throw conflict("Registration for this activity is closed.");
    if (toDate(a.starts_at) <= now) throw conflict("This activity has already started.");
    const taken = db.get<{ c: number }>(
      `SELECT COUNT(*) c FROM volunteering_registrations WHERE activity_id = ? AND status IN ('registered','verified')`,
      a.id,
    )!.c;
    const existing = db.get<{ id: string; status: string }>(
      `SELECT id, status FROM volunteering_registrations WHERE activity_id = ? AND student_id = ?`,
      a.id,
      actor.id,
    );
    if (existing && existing.status !== "cancelled") throw conflict("You are already registered.");
    if (taken >= a.capacity) throw conflict("This activity is full.");
    if (existing) {
      db.run(`UPDATE volunteering_registrations SET status = 'registered', registered_at = datetime('now') WHERE id = ?`, existing.id);
      return existing.id;
    }
    const id = newId("reg_");
    db.run(`INSERT INTO volunteering_registrations (id, activity_id, student_id, status) VALUES (?, ?, ?, 'registered')`, id, a.id, actor.id);
    notify(db, actor.id, {
      category: "volunteering",
      title: `You're registered: ${a.title}`,
      body: "Credits are added after the organizer verifies your participation.",
      href: "/app/volunteering",
      dedupeKey: `vreg:${id}`,
    });
    return id;
  });
}

export function cancelRegistration(db: Db, actor: Actor, activityId: string, now = new Date()) {
  assertCan(actor, "volunteering.register");
  db.tx(() => {
    const r = db.get<{ id: string; status: string; starts_at: string }>(
      `SELECT r.id, r.status, a.starts_at FROM volunteering_registrations r JOIN volunteering_activities a ON a.id = r.activity_id
       WHERE r.activity_id = ? AND r.student_id = ?`,
      activityId,
      actor.id,
    );
    if (!r || r.status !== "registered") throw conflict("No active registration to cancel.");
    if (toDate(r.starts_at) <= now) throw conflict("The activity has started; ask the organizer instead.");
    db.run(`UPDATE volunteering_registrations SET status = 'cancelled' WHERE id = ?`, r.id);
  });
}

function assertOrganizer(db: Db, actor: Actor, activityId: string) {
  assertCan(actor, "volunteering.organize");
  const a = db.get<{ organizer_id: string; school_id: string }>(
    `SELECT organizer_id, school_id FROM volunteering_activities WHERE id = ?`,
    activityId,
  );
  if (!a) throw notFound("Activity not found.");
  const ok = actor.role === "admin" ? a.school_id === actor.schoolId : a.organizer_id === actor.id;
  if (!ok) throw forbidden("Only the organizer can manage participation for this activity.");
}

export function activitiesOrganizedBy(db: Db, actor: Actor) {
  assertCan(actor, "volunteering.organize");
  const filter = actor.role === "admin" ? `a.school_id = ?` : `a.organizer_id = ?`;
  return db.all<ActivityView & { pending: number; verified: number }>(
    `SELECT a.*, u.display_name organizer_name,
            (SELECT COUNT(*) FROM volunteering_registrations r WHERE r.activity_id = a.id AND r.status IN ('registered','verified')) taken,
            (SELECT COUNT(*) FROM volunteering_registrations r WHERE r.activity_id = a.id AND r.status = 'registered') pending,
            (SELECT COUNT(*) FROM volunteering_registrations r WHERE r.activity_id = a.id AND r.status = 'verified') verified,
            NULL my_status, NULL my_registration_id
     FROM volunteering_activities a JOIN users u ON u.id = a.organizer_id
     WHERE ${filter} ORDER BY a.starts_at DESC`,
    actor.role === "admin" ? actor.schoolId : actor.id,
  );
}

export function activityRoster(db: Db, actor: Actor, activityId: string) {
  assertOrganizer(db, actor, activityId);
  return db.all<{ id: string; student_id: string; display_name: string; status: string; registered_at: string; verified_at: string | null }>(
    `SELECT r.id, r.student_id, u.display_name, r.status, r.registered_at, r.verified_at
     FROM volunteering_registrations r JOIN users u ON u.id = r.student_id
     WHERE r.activity_id = ? AND r.status <> 'cancelled' ORDER BY u.display_name`,
    activityId,
  );
}

/**
 * Organizer confirms (or does not confirm) attendance. Credits are granted
 * exactly once per registration, guarded by the ledger's idempotency key.
 * Marking "not verified" never removes previously earned credits.
 */
export function verifyParticipation(db: Db, actor: Actor, registrationId: string, attended: boolean, now = new Date()) {
  return db.tx(() => {
    const r = db.get<{ id: string; activity_id: string; student_id: string; status: string; credits: number; title: string; starts_at: string }>(
      `SELECT r.id, r.activity_id, r.student_id, r.status, a.credits, a.title, a.starts_at
       FROM volunteering_registrations r JOIN volunteering_activities a ON a.id = r.activity_id WHERE r.id = ?`,
      registrationId,
    );
    if (!r) throw notFound("Registration not found.");
    assertOrganizer(db, actor, r.activity_id);
    if (toDate(r.starts_at) > now) throw conflict("Participation can be verified once the activity has started.");
    if (r.status === "verified") return { credited: 0, alreadyVerified: true };
    if (r.status === "cancelled") throw conflict("This registration was cancelled.");
    if (!attended) {
      db.run(`UPDATE volunteering_registrations SET status = 'not_verified', verified_at = datetime('now'), verified_by = ? WHERE id = ?`, actor.id, r.id);
      audit(db, actor.id, "volunteering.not_verified", "volunteering_registration", r.id);
      return { credited: 0, alreadyVerified: false };
    }
    db.run(`UPDATE volunteering_registrations SET status = 'verified', verified_at = datetime('now'), verified_by = ? WHERE id = ?`, actor.id, r.id);
    const res = db.run(
      `INSERT INTO credit_transactions (id, user_id, amount, kind, reason, source_type, source_id, idempotency_key, created_by)
       VALUES (?, ?, ?, 'earn', ?, 'volunteering', ?, ?, ?) ON CONFLICT(idempotency_key) DO NOTHING`,
      newId("crd_"),
      r.student_id,
      r.credits,
      `Volunteering: ${r.title}`,
      r.id,
      `volunteer:${r.id}`,
      actor.id,
    );
    const credited = Number(res.changes) > 0 ? r.credits : 0;
    audit(db, actor.id, "volunteering.verified", "volunteering_registration", r.id, { credits: credited });
    if (credited) {
      notify(db, r.student_id, {
        category: "rewards",
        title: `+${credited} credits earned`,
        body: `Thank you for helping with “${r.title}”. Your participation was verified.`,
        href: "/app/courses",
        dedupeKey: `vcredit:${r.id}`,
      });
    }
    recordProgress(db, r.student_id, "volunteering_verified", 1, now);
    evaluateAchievements(db, r.student_id);
    return { credited, alreadyVerified: false };
  });
}

export function createActivity(
  db: Db,
  actor: Actor,
  input: { title: string; description: string; category: string; location: string; startsAt: string; durationMinutes: number; capacity: number; credits: number },
) {
  assertCan(actor, "volunteering.organize");
  const title = input.title.trim();
  if (title.length < 4 || title.length > 120) throw invalid("Title must be 4–120 characters.");
  if (!input.description.trim()) throw invalid("Add a short description.");
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 500) throw invalid("Capacity must be 1–500.");
  if (!Number.isInteger(input.credits) || input.credits < 1 || input.credits > 200) throw invalid("Credits must be 1–200.");
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 15 || input.durationMinutes > 600) throw invalid("Duration must be 15–600 minutes.");
  const starts = new Date(input.startsAt);
  if (Number.isNaN(starts.getTime())) throw invalid("Choose a valid start date and time.");
  const id = newId("act_");
  db.run(
    `INSERT INTO volunteering_activities (id, school_id, organizer_id, title, description, category, location, starts_at, duration_minutes, capacity, credits, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
    id,
    actor.schoolId,
    actor.id,
    title,
    input.description.trim().slice(0, 1000),
    input.category.slice(0, 40),
    input.location.trim().slice(0, 120),
    starts.toISOString(),
    input.durationMinutes,
    input.capacity,
    input.credits,
  );
  audit(db, actor.id, "volunteering.create", "volunteering_activity", id, { credits: input.credits });
  return id;
}
