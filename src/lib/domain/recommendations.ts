import type { Actor } from "../auth/types";
import type { Db } from "../db/client";
import { subjectSummaries } from "./catalog";
import { listDocuments } from "./documents";
import { listFlashcardSets, listQuizzes } from "./study";

/**
 * Workflow B — personalised learning suggestions. Transparent rules pick
 * subjects with a lower recent trend or average, then point to materials
 * the student already has access to. These are suggestions, never
 * assessments of ability, and are only shown to the student.
 */
export function revisionSuggestions(db: Db, actor: Actor, limit = 2) {
  const subjects = subjectSummaries(db, actor, actor.id).filter((s) => s.average != null);
  const scored = subjects
    .map((s) => ({ s, score: (s.average ?? 10) + (s.trend ?? 0) * 1.5 }))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
  const docs = listDocuments(db, actor).filter((d) => d.status === "indexed");
  const sets = listFlashcardSets(db, actor);
  const quizzes = listQuizzes(db, actor);
  return scored.map(({ s }) => ({
    subjectId: s.id,
    subject: s.name,
    color: s.color,
    reason:
      s.trend != null && s.trend <= -0.3
        ? `Your recent ${s.name} results are a little lower than earlier ones.`
        : `${s.name} is one of your lower averages right now.`,
    doc: docs.find((d) => d.subject_id === s.id) ?? null,
    set: sets.find((x) => x.subject_name === s.name) ?? null,
    quiz: quizzes.find((q) => q.subject_name === s.name) ?? null,
  }));
}
