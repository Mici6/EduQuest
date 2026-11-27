import type { Actor } from "../auth/types";
import { forbidden } from "../auth/errors";
import type { Db } from "../db/client";
import { json } from "../db/client";
import { toDate } from "../utils/dates";
import { activitiesOrganizedBy, activityRoster } from "./credits";

/** Items needing the teacher's attention on the dashboard. */
export function teacherInbox(db: Db, actor: Actor, now = new Date()) {
  if (actor.role !== "teacher") throw forbidden();
  const toReview = db.get<{ c: number }>(
    `SELECT COUNT(*) c FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE a.teacher_id = ? AND s.status = 'submitted'`,
    actor.id,
  )!.c;
  const drafts = db.get<{ c: number }>(
    `SELECT (SELECT COUNT(*) FROM quizzes WHERE owner_id = ? AND status = 'draft') + (SELECT COUNT(*) FROM flashcard_sets WHERE owner_id = ? AND status = 'draft') c`,
    actor.id,
    actor.id,
  )!.c;
  const toVerify = activitiesOrganizedBy(db, actor).filter((a) => toDate(a.starts_at) <= now).reduce((s, a) => s + a.pending, 0);
  return { toReview, drafts, toVerify };
}

/** Organizer view with rosters (teachers see their own activities; admins see the school's). */
export function organizerView(db: Db, actor: Actor, now = new Date()) {
  return activitiesOrganizedBy(db, actor).map((a) => ({
    id: a.id,
    title: a.title,
    starts_at: a.starts_at,
    credits: a.credits,
    capacity: a.capacity,
    taken: a.taken,
    pending: a.pending,
    verified: a.verified,
    organizer_name: a.organizer_name,
    started: toDate(a.starts_at) <= now,
    roster: activityRoster(db, actor, a.id).map((r) => {
      const hue = db.get<{ avatar_hue: number }>(`SELECT avatar_hue FROM users WHERE id = ?`, r.student_id)?.avatar_hue ?? 40;
      return { id: r.id, display_name: r.display_name, avatar_hue: hue, status: r.status };
    }),
  }));
}

/** Teacher's own drafts and published AI/manual content for the studio. */
export function studioContent(db: Db, actor: Actor) {
  if (actor.role !== "teacher") throw forbidden();
  const quizzes = db.all<{ id: string; title: string; origin: string; status: string; class_name: string | null; subject: string | null; n: number }>(
    `SELECT q.id, q.title, q.origin, q.status, c.name class_name, s.name subject, (SELECT COUNT(*) FROM quiz_questions x WHERE x.quiz_id = q.id) n
     FROM quizzes q LEFT JOIN classes c ON c.id = q.class_id LEFT JOIN subjects s ON s.id = q.subject_id
     WHERE q.owner_id = ? ORDER BY q.status = 'published', q.created_at DESC`,
    actor.id,
  );
  const sets = db.all<{ id: string; title: string; origin: string; status: string; class_name: string | null; subject: string | null; n: number }>(
    `SELECT f.id, f.title, f.origin, f.status, c.name class_name, s.name subject, (SELECT COUNT(*) FROM flashcards x WHERE x.set_id = f.id) n
     FROM flashcard_sets f LEFT JOIN classes c ON c.id = f.class_id LEFT JOIN subjects s ON s.id = f.subject_id
     WHERE f.owner_id = ? ORDER BY f.status = 'published', f.created_at DESC`,
    actor.id,
  );
  return [
    ...quizzes.map((q) => ({
      kind: "quiz" as const,
      id: q.id,
      title: q.title,
      origin: q.origin,
      status: q.status,
      className: q.class_name,
      subject: q.subject,
      count: q.n,
      questions: db
        .all<{ type: "mcq" | "true_false" | "short"; prompt: string; options: string; answer: string; explanation: string; topic: string | null }>(
          `SELECT type, prompt, options, answer, explanation, topic FROM quiz_questions WHERE quiz_id = ? ORDER BY position`,
          q.id,
        )
        .map((x) => ({ ...x, options: json<string[]>(x.options, []), topic: x.topic ?? "" })),
    })),
    ...sets.map((s) => ({ kind: "flashcards" as const, id: s.id, title: s.title, origin: s.origin, status: s.status, className: s.class_name, subject: s.subject, count: s.n })),
  ];
}
