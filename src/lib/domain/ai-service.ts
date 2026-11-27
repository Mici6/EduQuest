import type { Actor } from "../auth/types";
import { assertCan, can } from "../auth/policy";
import { DomainError, invalid, notFound } from "../auth/errors";
import type { Db } from "../db/client";
import { json, newId } from "../db/client";
import { GROUNDING_THRESHOLD, retrieve, type RetrievedChunk } from "../ai/retrieval";
import { clampFlashcardCount, clampQuizOptions, type AiProvider, type ChatTurn, type PlanInput, type QuizOptions, type SummaryOptions, type TutorLevel } from "../ai/types";
import { isoDate } from "../utils/dates";
import { subjectSummaries, upcomingEvents } from "./catalog";
import { documentText, groundingDocumentIds, listDocuments } from "./documents";
import { recordProgress } from "./gamification";
import { createFlashcardSet, createQuiz } from "./study";

// ── Usage controls ──────────────────────────────────────────────────────────

/** Atomically count an AI request against the user's daily allowance. */
export function consumeAiQuota(db: Db, actor: Actor, dailyLimit: number, now = new Date()) {
  const day = isoDate(now);
  db.tx(() => {
    const used = db.get<{ requests: number }>(`SELECT requests FROM ai_usage WHERE user_id = ? AND day = ?`, actor.id, day)?.requests ?? 0;
    if (used >= dailyLimit) {
      throw new DomainError(`You've reached today's limit of ${dailyLimit} AI requests. It resets tomorrow.`, "rate_limited");
    }
    db.run(
      `INSERT INTO ai_usage (user_id, day, requests) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET requests = requests + 1`,
      actor.id,
      day,
    );
  });
}

export function aiUsageToday(db: Db, actor: Actor, now = new Date()): number {
  return db.get<{ requests: number }>(`SELECT requests FROM ai_usage WHERE user_id = ? AND day = ?`, actor.id, isoDate(now))?.requests ?? 0;
}

// ── Tutor conversations ──────────────────────────────────────────────────────────

export type Source = { id: string; documentId: string; title: string; heading: string | null; excerpt: string; score: number };

export function listConversations(db: Db, actor: Actor) {
  return db.all<{ id: string; title: string; updated_at: string; document_id: string | null; messages: number }>(
    `SELECT c.id, c.title, c.updated_at, c.document_id, (SELECT COUNT(*) FROM ai_messages m WHERE m.conversation_id = c.id) messages
     FROM ai_conversations c WHERE c.user_id = ? ORDER BY c.updated_at DESC LIMIT 30`,
    actor.id,
  );
}

export function getConversation(db: Db, actor: Actor, id: string) {
  const conv = db.get<{ id: string; title: string; document_id: string | null }>(
    `SELECT id, title, document_id FROM ai_conversations WHERE id = ? AND user_id = ?`,
    id,
    actor.id,
  );
  if (!conv) throw notFound("Conversation not found.");
  const messages = db
    .all<{ id: string; role: "user" | "assistant"; content: string; sources: string; grounding: string | null; provider: string | null; simulated: number; created_at: string }>(
      `SELECT id, role, content, sources, grounding, provider, simulated, created_at FROM ai_messages WHERE conversation_id = ? ORDER BY created_at, rowid`,
      id,
    )
    .map((m) => ({ ...m, sources: json<Source[]>(m.sources, []) }));
  return { conv, messages };
}

export function deleteConversation(db: Db, actor: Actor, id: string) {
  const res = db.run(`DELETE FROM ai_conversations WHERE id = ? AND user_id = ?`, id, actor.id);
  if (Number(res.changes) === 0) throw notFound();
}

export function toSources(chunks: RetrievedChunk[]): Source[] {
  return chunks.map((c) => ({ id: c.chunkId, documentId: c.documentId, title: c.documentTitle, heading: c.heading, excerpt: c.content.slice(0, 420), score: c.score }));
}

/**
 * Prepare a tutor turn: authorise, persist the user's message, retrieve
 * grounding passages from documents the student may read, and decide
 * whether the answer can be grounded in lesson material.
 */
export function prepareTutorTurn(
  db: Db,
  actor: Actor,
  input: { conversationId?: string | null; message: string; documentId?: string | null; level: TutorLevel },
) {
  assertCan(actor, "study.use");
  const message = input.message.trim();
  if (!message) throw invalid("Type a question first.");
  if (message.length > 4000) throw invalid("Please keep questions under 4,000 characters.");
  let conversationId = input.conversationId ?? null;
  let documentId = input.documentId ?? null;
  if (conversationId) {
    const c = db.get<{ document_id: string | null }>(`SELECT document_id FROM ai_conversations WHERE id = ? AND user_id = ?`, conversationId, actor.id);
    if (!c) throw notFound("Conversation not found.");
    documentId = documentId ?? c.document_id;
  } else {
    conversationId = newId("cnv_");
    db.run(`INSERT INTO ai_conversations (id, user_id, title, document_id) VALUES (?, ?, ?, ?)`, conversationId, actor.id, message.slice(0, 60), documentId);
  }
  const history = db
    .all<ChatTurn>(`SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY created_at, rowid`, conversationId)
    .slice(-10);
  db.run(`INSERT INTO ai_messages (id, conversation_id, role, content) VALUES (?, ?, 'user', ?)`, newId("msg_"), conversationId, message);
  db.run(`UPDATE ai_conversations SET updated_at = datetime('now') WHERE id = ?`, conversationId);

  const docIds = groundingDocumentIds(db, actor, documentId);
  // Include the previous question for follow-ups like "explain it simpler".
  const lastUser = [...history].reverse().find((h) => h.role === "user")?.content ?? "";
  const chunks = retrieve(db, docIds, `${message} ${message.length < 60 ? lastUser : ""}`, 4);
  const grounded = chunks.length > 0 && chunks[0]!.score >= GROUNDING_THRESHOLD;
  const sources = grounded ? chunks.filter((c) => c.score >= GROUNDING_THRESHOLD * 0.6) : [];
  return { conversationId, history, sources, grounded };
}

export function saveAssistantMessage(
  db: Db,
  actor: Actor,
  conversationId: string,
  content: string,
  sources: Source[],
  grounding: "lesson" | "general" | "none",
  provider: Pick<AiProvider, "id" | "simulated">,
) {
  db.run(
    `INSERT INTO ai_messages (id, conversation_id, role, content, sources, grounding, provider, simulated) VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?)`,
    newId("msg_"),
    conversationId,
    content,
    JSON.stringify(sources),
    grounding,
    provider.id,
    provider.simulated ? 1 : 0,
  );
  const turns = db.get<{ c: number }>(`SELECT COUNT(*) c FROM ai_messages WHERE conversation_id = ? AND role = 'assistant'`, conversationId)!.c;
  if (turns === 1) recordProgress(db, actor.id, "ai_session");
}

/** Store a reply the on-device model produced for one of the caller's own conversations. */
export function saveBrowserTutorReply(db: Db, actor: Actor, conversationId: string, content: string, sources: Source[], grounding: "lesson" | "general") {
  if (!db.get(`SELECT 1 FROM ai_conversations WHERE id = ? AND user_id = ?`, conversationId, actor.id)) throw notFound("Conversation not found.");
  const text = content.trim().slice(0, 20000);
  if (!text) throw invalid("Empty reply.");
  saveAssistantMessage(db, actor, conversationId, text, sources.slice(0, 6), grounding, { id: "browser", simulated: false });
}

// ── Generators ──────────────────────────────────────────────────────────────────────

export type SourceSpec = { documentId?: string | null; topic?: string | null; text?: string | null };

/** Resolve generation source text from a document, a topic search, or pasted notes. */
export function resolveSourceText(db: Db, actor: Actor, spec: SourceSpec): { text: string; title: string; documentId: string | null; subjectId: string | null } {
  if (spec.documentId) {
    const { doc, text } = documentText(db, actor, spec.documentId);
    return { text, title: doc.title, documentId: doc.id, subjectId: doc.subject_id };
  }
  if (spec.text && spec.text.trim().length >= 80) {
    return { text: spec.text.trim().slice(0, 60000), title: spec.topic?.trim() || "My notes", documentId: null, subjectId: null };
  }
  if (spec.topic && spec.topic.trim()) {
    const chunks = retrieve(db, groundingDocumentIds(db, actor), spec.topic, 6);
    if (!chunks.length || chunks[0]!.score < GROUNDING_THRESHOLD) {
      throw invalid(`No lesson materials you can access cover “${spec.topic.trim()}”. Upload notes or pick a document.`);
    }
    return { text: chunks.map((c) => c.content).join("\n\n"), title: spec.topic.trim(), documentId: null, subjectId: null };
  }
  throw invalid("Choose a document, a topic, or paste at least a paragraph of notes.");
}

/** Source text for a generator, after the same access checks the server generators use. */
export function generationSource(db: Db, actor: Actor, spec: SourceSpec) {
  assertCan(actor, "study.use");
  return resolveSourceText(db, actor, spec);
}

export async function generateSummary(db: Db, actor: Actor, ai: AiProvider, spec: SourceSpec, opts: SummaryOptions) {
  const src = generationSource(db, actor, spec);
  const summary = await ai.summarize(src.text, src.title, opts);
  return { summary, simulated: ai.simulated, provider: ai.label, sourceTitle: src.title };
}

export async function generateFlashcards(db: Db, actor: Actor, ai: AiProvider, spec: SourceSpec, count: number) {
  const n = clampFlashcardCount(count);
  const src = generationSource(db, actor, spec);
  const cards = await ai.flashcards(src.text, src.title, n);
  if (!cards.length) throw invalid("Not enough suitable content was found to make flashcards from this source.");
  return { cards, sourceTitle: src.title, documentId: src.documentId, subjectId: src.subjectId, simulated: ai.simulated, provider: ai.label };
}

export async function generateQuiz(db: Db, actor: Actor, ai: AiProvider, spec: SourceSpec, opts: QuizOptions) {
  const o = clampQuizOptions(opts);
  const src = generationSource(db, actor, spec);
  const questions = await ai.quiz(src.text, src.title, o);
  if (!questions.length) throw invalid("Not enough suitable content was found to build a quiz from this source.");
  return { questions, sourceTitle: src.title, documentId: src.documentId, subjectId: src.subjectId, simulated: ai.simulated, provider: ai.label };
}

/** Save generated flashcards. Teachers get a draft that must be reviewed before publishing. */
export function saveGeneratedFlashcards(
  db: Db,
  actor: Actor,
  input: { title: string; cards: { front: string; back: string }[]; documentId?: string | null; subjectId?: string | null; simulated: boolean },
) {
  return createFlashcardSet(db, actor, { ...input, origin: input.simulated ? "simulated" : "ai" });
}

export function saveGeneratedQuiz(
  db: Db,
  actor: Actor,
  input: {
    title: string;
    questions: Parameters<typeof createQuiz>[2]["questions"];
    difficulty: "easy" | "medium" | "hard";
    kind?: "quiz" | "practice_test";
    timeLimitS?: number | null;
    documentId?: string | null;
    subjectId?: string | null;
    topic?: string;
    simulated: boolean;
  },
) {
  return createQuiz(db, actor, { ...input, origin: input.simulated ? "simulated" : "ai" });
}

/** Personalised revision plan (Workflow B). Signals are suggestions, never assessments. */
export async function buildStudyPlan(db: Db, actor: Actor, ai: AiProvider, input: { days: number; minutesPerDay: number }) {
  const plan = await ai.studyPlan(studyPlanInput(db, actor, input));
  return { plan, simulated: ai.simulated, provider: ai.label };
}

export function studyPlanInput(db: Db, actor: Actor, input: { days: number; minutesPerDay: number }): PlanInput {
  if (actor.role !== "student") throw invalid("Study plans are available to students.");
  const days = Math.max(2, Math.min(7, Math.round(input.days)));
  const minutes = Math.max(15, Math.min(60, Math.round(input.minutesPerDay)));
  const subjects = subjectSummaries(db, actor, actor.id);
  const events = upcomingEvents(db, actor, 14);
  const materials = listDocuments(db, actor).filter((d) => d.status === "indexed").slice(0, 12);
  return {
    studentName: actor.displayName.split(" ")[0]!,
    days,
    minutesPerDay: minutes,
    subjects: subjects.map((s) => ({
      name: s.name,
      average: s.average,
      trend: s.trend,
      upcoming: events.filter((e) => e.title.toLowerCase().includes(s.name.toLowerCase().split(" ")[0]!)).map((e) => `${e.title} (${e.date})`),
    })),
    materials: materials.map((m) => ({ title: m.title, subject: m.subject_name })),
  };
}

export async function homeworkHelp(db: Db, actor: Actor, ai: AiProvider, input: { question: string; level: TutorLevel; documentId?: string | null }) {
  const { question, chunks, sources } = homeworkContext(db, actor, input);
  const help = await ai.homework(question, chunks, input.level);
  return { help, sources, simulated: ai.simulated, provider: ai.label };
}

/** Validated question plus the lesson excerpts it can be grounded in. */
export function homeworkContext(db: Db, actor: Actor, input: { question: string; documentId?: string | null }) {
  assertCan(actor, "study.use");
  const q = input.question.trim();
  if (q.length < 8) throw invalid("Paste or type the full question.");
  if (q.length > 8000) throw invalid("That question is too long.");
  const chunks = retrieve(db, groundingDocumentIds(db, actor, input.documentId), q, 3);
  const grounded = chunks.filter((c) => c.score >= GROUNDING_THRESHOLD);
  return { question: q, chunks: grounded, sources: toSources(grounded) };
}

export function canUseAi(actor: Actor) {
  return can(actor, "study.use");
}
