import type { Actor } from "../auth/types";
import { forbidden, invalid } from "../auth/errors";
import type { ChatTurn, CompanionContext } from "../ai/types";
import type { Db } from "../db/client";
import { homeworkFor, nextClass } from "./catalog";
import { levelInfo, streak } from "./gamification";

/**
 * Irbis, the snow-leopard study companion. The conversation lives only in the
 * student's browser tab; the server just builds a small, non-judgemental
 * context (no grades or support data) and validates each turn.
 */

export const COMPANION_MAX_MESSAGE = 1000;
const MAX_TURNS = 10;

const fmtDue = (iso: string, now: Date) => {
  const d = new Date(iso.replace(" ", "T"));
  const days = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
};

export function companionContext(db: Db, actor: Actor, now = new Date()): CompanionContext {
  if (actor.role !== "student") throw forbidden();
  const lv = levelInfo(db, actor.id);
  const st = streak(db, actor.id, now);
  const homework = homeworkFor(db, actor, actor.id)
    .filter((h) => h.state === "overdue" || h.state === "due_soon" || h.state === "open")
    .sort((a, b) => a.due_at.localeCompare(b.due_at))
    .slice(0, 5)
    .map((h) => ({ title: h.title, subject: h.subject_name, due: fmtDue(h.due_at, now), overdue: h.state === "overdue" }));
  const nc = nextClass(db, actor, now);
  const course = db.get<{ title: string; lessons: string; lessons_done: string }>(
    `SELECT title, lessons, lessons_done FROM ai_courses WHERE student_id = ? AND status = 'approved' ORDER BY reviewed_at DESC LIMIT 1`,
    actor.id,
  );
  return {
    firstName: actor.displayName.split(" ")[0]!,
    localTime: now.toLocaleString("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit" }),
    level: lv.level,
    levelTitle: lv.title,
    streakDays: st.current,
    activeToday: st.activeToday,
    homework,
    nextClass: nc ? { subject: nc.subject_name, when: nc.inDays === 0 ? `today at ${nc.starts_at}` : nc.inDays === 1 ? `tomorrow at ${nc.starts_at}` : `in ${nc.inDays} days` } : null,
    course: course ? { title: course.title, lessons: (JSON.parse(course.lessons) as unknown[]).length, lessonsDone: (JSON.parse(course.lessons_done) as unknown[]).length } : null,
  };
}

/** Validate a turn sent from the browser: message length, and a short, well-formed history. */
export function companionTurn(raw: { message?: unknown; history?: unknown }): { message: string; history: ChatTurn[] } {
  const message = String(raw.message ?? "").trim();
  if (!message) throw invalid("Say something to Irbis first.");
  if (message.length > COMPANION_MAX_MESSAGE) throw invalid(`Keep messages under ${COMPANION_MAX_MESSAGE} characters.`);
  const history = (Array.isArray(raw.history) ? raw.history : [])
    .filter((t): t is ChatTurn => !!t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .slice(-MAX_TURNS)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 2000) }));
  return { message, history };
}
