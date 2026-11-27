"use server";

import { refresh } from "next/cache";
import { requireActor } from "@/lib/auth/current";
import { aiAllowed, aiFor, withAiErrors } from "@/lib/ai/guard";
import type { QuizOptions, SummaryOptions, TutorLevel } from "@/lib/ai/types";
import { getDb } from "@/lib/db";
import {
  buildStudyPlan,
  deleteConversation,
  generateFlashcards,
  generationSource,
  generateQuiz,
  generateSummary,
  homeworkContext,
  homeworkHelp,
  saveBrowserTutorReply,
  saveGeneratedFlashcards,
  saveGeneratedQuiz,
  studyPlanInput,
  type Source,
  type SourceSpec,
} from "@/lib/domain/ai-service";
import { deleteDocument, documentText } from "@/lib/domain/documents";
import { deleteOwnContent, publishContent, replaceQuizQuestions, updateFlashcardSet, type QuestionInput } from "@/lib/domain/study";
import { attempt } from "./_run";

function spec(s: SourceSpec): SourceSpec {
  return {
    documentId: s.documentId ? String(s.documentId) : null,
    topic: s.topic ? String(s.topic).slice(0, 200) : null,
    text: s.text ? String(s.text).slice(0, 60000) : null,
  };
}

export async function generateSummaryAction(source: SourceSpec, opts: SummaryOptions) {
  const actor = await requireActor(["student", "teacher"]);
  return attempt(() => {
    const db = getDb();
    const ai = aiFor(db, actor);
    const o: SummaryOptions = { length: opts.length === "detailed" ? "detailed" : "concise", format: ["notes", "chapter", "revision"].includes(opts.format) ? opts.format : "notes" };
    return withAiErrors(() => generateSummary(db, actor, ai, spec(source), o));
  });
}

export async function generateFlashcardsAction(source: SourceSpec, count: number) {
  const actor = await requireActor(["student", "teacher"]);
  return attempt(() => {
    const db = getDb();
    const ai = aiFor(db, actor);
    return withAiErrors(() => generateFlashcards(db, actor, ai, spec(source), Number(count) || 10));
  });
}

export async function generateQuizAction(source: SourceSpec, opts: QuizOptions) {
  const actor = await requireActor(["student", "teacher"]);
  return attempt(() => {
    const db = getDb();
    const ai = aiFor(db, actor);
    const o: QuizOptions = {
      count: Number(opts.count) || 6,
      difficulty: ["easy", "medium", "hard"].includes(opts.difficulty) ? opts.difficulty : "medium",
      types: Array.isArray(opts.types) ? opts.types : ["mcq"],
      topic: opts.topic ? String(opts.topic).slice(0, 120) : undefined,
    };
    return withAiErrors(() => generateQuiz(db, actor, ai, spec(source), o));
  });
}

export async function saveFlashcardSetAction(input: { title: string; cards: { front: string; back: string }[]; documentId?: string | null; subjectId?: string | null; simulated: boolean }) {
  const actor = await requireActor(["student", "teacher"]);
  const res = await attempt(() =>
    saveGeneratedFlashcards(getDb(), actor, {
      title: String(input.title ?? ""),
      cards: (input.cards ?? []).map((c) => ({ front: String(c.front ?? ""), back: String(c.back ?? "") })),
      documentId: input.documentId ? String(input.documentId) : null,
      subjectId: input.subjectId ? String(input.subjectId) : null,
      simulated: input.simulated === true,
    }),
  );
  if (res.ok) refresh();
  return res;
}

export async function saveQuizAction(input: {
  title: string;
  questions: QuestionInput[];
  difficulty: "easy" | "medium" | "hard";
  kind?: "quiz" | "practice_test";
  timeLimitS?: number | null;
  documentId?: string | null;
  subjectId?: string | null;
  topic?: string;
  simulated: boolean;
}) {
  const actor = await requireActor(["student", "teacher"]);
  const res = await attempt(() =>
    saveGeneratedQuiz(getDb(), actor, {
      title: String(input.title ?? ""),
      questions: input.questions ?? [],
      difficulty: ["easy", "medium", "hard"].includes(input.difficulty) ? input.difficulty : "medium",
      kind: input.kind === "practice_test" ? "practice_test" : "quiz",
      timeLimitS: input.timeLimitS ? Math.max(60, Math.min(7200, Math.round(Number(input.timeLimitS)))) : null,
      documentId: input.documentId ? String(input.documentId) : null,
      subjectId: input.subjectId ? String(input.subjectId) : null,
      topic: input.topic ? String(input.topic) : undefined,
      simulated: input.simulated === true,
    }),
  );
  if (res.ok) refresh();
  return res;
}

export async function updateQuizAction(quizId: string, input: { title: string; questions: QuestionInput[] }) {
  const actor = await requireActor(["student", "teacher"]);
  const res = await attempt(() => replaceQuizQuestions(getDb(), actor, String(quizId), { title: String(input.title ?? ""), questions: input.questions ?? [] }));
  if (res.ok) refresh();
  return res;
}

export async function updateFlashcardSetAction(setId: string, input: { title: string; cards: { front: string; back: string }[] }) {
  const actor = await requireActor(["student", "teacher"]);
  const res = await attempt(() => updateFlashcardSet(getDb(), actor, String(setId), { title: String(input.title ?? ""), cards: input.cards ?? [] }));
  if (res.ok) refresh();
  return res;
}

export async function publishContentAction(kind: "quiz" | "flashcards", id: string, classId: string) {
  const actor = await requireActor(["teacher"]);
  const res = await attempt(() => publishContent(getDb(), actor, kind === "quiz" ? "quiz" : "flashcards", String(id), String(classId)));
  if (res.ok) refresh();
  return res;
}

export async function deleteContentAction(kind: "quiz" | "flashcards", id: string) {
  const actor = await requireActor(["student", "teacher"]);
  const res = await attempt(() => deleteOwnContent(getDb(), actor, kind === "quiz" ? "quiz" : "flashcards", String(id)));
  if (res.ok) refresh();
  return res;
}

export async function studyPlanAction(days: number, minutesPerDay: number) {
  const actor = await requireActor(["student"]);
  return attempt(() => {
    const db = getDb();
    const ai = aiFor(db, actor);
    return withAiErrors(() => buildStudyPlan(db, actor, ai, { days: Number(days) || 5, minutesPerDay: Number(minutesPerDay) || 30 }));
  });
}

export async function homeworkHelpAction(question: string, level: TutorLevel, documentId: string | null) {
  const actor = await requireActor(["student", "teacher"]);
  return attempt(() => {
    const db = getDb();
    const ai = aiFor(db, actor);
    const lv: TutorLevel = level === "simpler" || level === "advanced" ? level : "standard";
    return withAiErrors(() => homeworkHelp(db, actor, ai, { question: String(question ?? ""), level: lv, documentId: documentId ? String(documentId) : null }));
  });
}

export async function deleteConversationAction(id: string) {
  const actor = await requireActor();
  const res = await attempt(() => deleteConversation(getDb(), actor, String(id)));
  if (res.ok) refresh();
  return res;
}

export async function deleteDocumentAction(id: string) {
  const actor = await requireActor();
  const res = await attempt(() => deleteDocument(getDb(), actor, String(id)));
  if (res.ok) refresh();
  return res;
}

/** Extracted text of a document the caller may read (used to prefill tools). */
export async function documentTextAction(id: string) {
  const actor = await requireActor(["student", "teacher"]);
  return attempt(() => documentText(getDb(), actor, String(id)).text.slice(0, 20000));
}

// ── On-device AI: the server checks access and quota and supplies the
// context; the model itself runs in the visitor's browser. ──────────────────

export async function aiSourceAction(source: SourceSpec) {
  const actor = await requireActor(["student", "teacher"]);
  return attempt(() => {
    const db = getDb();
    aiAllowed(db, actor);
    const src = generationSource(db, actor, spec(source));
    return { ...src, text: src.text.slice(0, 20000) };
  });
}

export async function homeworkContextAction(question: string, documentId: string | null) {
  const actor = await requireActor(["student", "teacher"]);
  return attempt(() => {
    const db = getDb();
    aiAllowed(db, actor);
    return homeworkContext(db, actor, { question: String(question ?? ""), documentId: documentId ? String(documentId) : null });
  });
}

export async function studyPlanInputAction(days: number, minutesPerDay: number) {
  const actor = await requireActor(["student"]);
  return attempt(() => {
    const db = getDb();
    aiAllowed(db, actor);
    return studyPlanInput(db, actor, { days: Number(days) || 5, minutesPerDay: Number(minutesPerDay) || 30 });
  });
}

export async function saveTutorReplyAction(conversationId: string, content: string, sources: Source[], grounding: "lesson" | "general") {
  const actor = await requireActor();
  return attempt(() =>
    saveBrowserTutorReply(
      getDb(),
      actor,
      String(conversationId),
      String(content ?? ""),
      (Array.isArray(sources) ? sources : []).map((s) => ({
        id: String(s.id),
        documentId: String(s.documentId),
        title: String(s.title).slice(0, 200),
        heading: s.heading ? String(s.heading).slice(0, 200) : null,
        excerpt: String(s.excerpt).slice(0, 420),
        score: Number(s.score) || 0,
      })),
      grounding === "lesson" ? "lesson" : "general",
    ),
  );
}
