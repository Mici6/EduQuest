import type { Actor } from "../auth/types";
import { assertCan, studentClassIds, teacherClassIds, teacherTeaches } from "../auth/policy";
import { conflict, forbidden, invalid, notFound } from "../auth/errors";
import type { Db } from "../db/client";
import { json, newId } from "../db/client";
import { addDays, isoDate } from "../utils/dates";
import { evaluateAchievements, grantXp, recordProgress } from "./gamification";

// ── Visibility ─────────────────────────────────────────────────────────────

/**
 * A study resource is visible to its owner; published class resources are
 * visible to students of that class and teachers of that class.
 */
function visibilityClause(db: Db, actor: Actor, alias: string): { sql: string; params: string[] } {
  const classIds = actor.role === "student" ? studentClassIds(db, actor.id) : actor.role === "teacher" ? teacherClassIds(db, actor.id) : [];
  const placeholders = classIds.map(() => "?").join(",") || "''";
  return {
    sql: `(${alias}.owner_id = ? OR (${alias}.status = 'published' AND ${alias}.class_id IN (${placeholders})))`,
    params: [actor.id, ...classIds],
  };
}

// ── Flashcards ─────────────────────────────────────────────────────────────────

export type FlashcardSetView = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  origin: string;
  owner_id: string;
  owner_name: string;
  subject_name: string | null;
  subject_color: string | null;
  class_id: string | null;
  cards: number;
  mastered: number;
  due: number;
};

export function listFlashcardSets(db: Db, actor: Actor): FlashcardSetView[] {
  const v = visibilityClause(db, actor, "fs");
  const today = isoDate();
  return db.all<FlashcardSetView>(
    `SELECT fs.id, fs.title, fs.description, fs.status, fs.origin, fs.owner_id, u.display_name owner_name, s.name subject_name, s.color subject_color, fs.class_id,
            (SELECT COUNT(*) FROM flashcards f WHERE f.set_id = fs.id) cards,
            (SELECT COUNT(*) FROM flashcards f JOIN flashcard_progress p ON p.card_id = f.id AND p.user_id = ? WHERE f.set_id = fs.id AND p.box >= 4) mastered,
            (SELECT COUNT(*) FROM flashcards f LEFT JOIN flashcard_progress p ON p.card_id = f.id AND p.user_id = ? WHERE f.set_id = fs.id AND (p.due_on IS NULL OR p.due_on <= ?)) due
     FROM flashcard_sets fs JOIN users u ON u.id = fs.owner_id LEFT JOIN subjects s ON s.id = fs.subject_id
     WHERE ${v.sql} ORDER BY fs.created_at DESC`,
    actor.id,
    actor.id,
    today,
    ...v.params,
  );
}

function loadSet(db: Db, actor: Actor, setId: string) {
  const v = visibilityClause(db, actor, "fs");
  const set = db.get<FlashcardSetView>(
    `SELECT fs.id, fs.title, fs.description, fs.status, fs.origin, fs.owner_id, u.display_name owner_name, s.name subject_name, s.color subject_color, fs.class_id,
            0 cards, 0 mastered, 0 due
     FROM flashcard_sets fs JOIN users u ON u.id = fs.owner_id LEFT JOIN subjects s ON s.id = fs.subject_id
     WHERE fs.id = ? AND ${v.sql}`,
    setId,
    ...v.params,
  );
  if (!set) throw notFound("Flashcard set not found.");
  return set;
}

export function getFlashcardSet(db: Db, actor: Actor, setId: string) {
  const set = loadSet(db, actor, setId);
  const cards = db.all<{ id: string; front: string; back: string; position: number; box: number | null; correct: number | null; incorrect: number | null; due_on: string | null }>(
    `SELECT f.id, f.front, f.back, f.position, p.box, p.correct, p.incorrect, p.due_on
     FROM flashcards f LEFT JOIN flashcard_progress p ON p.card_id = f.id AND p.user_id = ?
     WHERE f.set_id = ? ORDER BY f.position`,
    actor.id,
    setId,
  );
  return { set, cards };
}

/** Leitner intervals in days for boxes 1..5. */
const BOX_INTERVAL = [0, 1, 2, 4, 7, 14];
export const FLASHCARD_XP_DAILY_CAP = 40;

export function reviewCard(db: Db, actor: Actor, cardId: string, correct: boolean, now = new Date()) {
  assertCan(actor, "study.use");
  const card = db.get<{ id: string; set_id: string }>(`SELECT id, set_id FROM flashcards WHERE id = ?`, cardId);
  if (!card) throw notFound("Card not found.");
  loadSet(db, actor, card.set_id); // visibility check
  return db.tx(() => {
    const p = db.get<{ box: number }>(`SELECT box FROM flashcard_progress WHERE card_id = ? AND user_id = ?`, cardId, actor.id);
    const box = correct ? Math.min(5, (p?.box ?? 1) + 1) : 1;
    const due = isoDate(addDays(now, correct ? BOX_INTERVAL[box]! : 0));
    db.run(
      `INSERT INTO flashcard_progress (card_id, user_id, box, correct, incorrect, due_on, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(card_id, user_id) DO UPDATE SET box = excluded.box, correct = correct + excluded.correct,
         incorrect = incorrect + excluded.incorrect, due_on = excluded.due_on, reviewed_at = excluded.reviewed_at`,
      cardId,
      actor.id,
      box,
      correct ? 1 : 0,
      correct ? 0 : 1,
      due,
    );
    let xp = 0;
    if (actor.role === "student") {
      const day = isoDate(now);
      const today = db.get<{ s: number }>(
        `SELECT COALESCE(SUM(amount), 0) s FROM xp_transactions WHERE user_id = ? AND source_type = 'flashcard' AND date(created_at, 'localtime') = ?`,
        actor.id,
        day,
      )!.s;
      if (today < FLASHCARD_XP_DAILY_CAP) {
        xp = grantXp(db, { userId: actor.id, amount: 2, reason: "Flashcard review", sourceType: "flashcard", sourceId: cardId, key: `fc:${cardId}:${actor.id}:${day}` });
      }
      recordProgress(db, actor.id, "flashcards_reviewed", 1, now);
      evaluateAchievements(db, actor.id);
    }
    return { box, due, xp };
  });
}

export function createFlashcardSet(
  db: Db,
  actor: Actor,
  input: { title: string; description?: string; subjectId?: string | null; classId?: string | null; documentId?: string | null; origin: "manual" | "ai" | "simulated"; cards: { front: string; back: string }[] },
) {
  assertCan(actor, "study.use");
  const title = input.title.trim();
  if (title.length < 2 || title.length > 120) throw invalid("Title must be 2–120 characters.");
  const cards = input.cards.map((c) => ({ front: c.front.trim(), back: c.back.trim() })).filter((c) => c.front && c.back);
  if (!cards.length) throw invalid("Add at least one card with a front and a back.");
  if (cards.length > 200) throw invalid("A set can have at most 200 cards.");
  if (cards.some((c) => c.front.length > 500 || c.back.length > 2000)) throw invalid("A card is too long.");
  let classId: string | null = null;
  let status: "draft" | "published" = "published";
  if (actor.role === "teacher") {
    // Teacher content starts as a draft so it is reviewed before students see it.
    if (input.classId) {
      if (!teacherTeaches(db, actor.id, input.classId)) throw forbidden();
      classId = input.classId;
    }
    status = "draft";
  }
  const id = newId("fs_");
  db.tx(() => {
    db.run(
      `INSERT INTO flashcard_sets (id, owner_id, class_id, subject_id, document_id, title, description, status, origin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      actor.id,
      classId,
      input.subjectId ?? null,
      input.documentId ?? null,
      title,
      input.description?.trim().slice(0, 500) ?? null,
      status,
      input.origin,
    );
    cards.forEach((c, i) => db.run(`INSERT INTO flashcards (id, set_id, front, back, position) VALUES (?, ?, ?, ?, ?)`, newId("fc_"), id, c.front, c.back, i));
  });
  return id;
}

export function updateFlashcardSet(db: Db, actor: Actor, setId: string, input: { title: string; cards: { front: string; back: string }[] }) {
  const set = db.get<{ owner_id: string }>(`SELECT owner_id FROM flashcard_sets WHERE id = ?`, setId);
  if (!set || set.owner_id !== actor.id) throw forbidden();
  const cards = input.cards.map((c) => ({ front: c.front.trim(), back: c.back.trim() })).filter((c) => c.front && c.back);
  if (!cards.length) throw invalid("Keep at least one card.");
  db.tx(() => {
    db.run(`UPDATE flashcard_sets SET title = ? WHERE id = ?`, input.title.trim().slice(0, 120) || "Untitled set", setId);
    db.run(`DELETE FROM flashcards WHERE set_id = ?`, setId);
    cards.forEach((c, i) => db.run(`INSERT INTO flashcards (id, set_id, front, back, position) VALUES (?, ?, ?, ?, ?)`, newId("fc_"), setId, c.front.slice(0, 500), c.back.slice(0, 2000), i));
  });
}

// ── Quizzes ──────────────────────────────────────────────────────────────────────

export type QuestionInput = {
  type: "mcq" | "true_false" | "short";
  prompt: string;
  options?: string[];
  answer: string;
  explanation: string;
  topic?: string;
};

export type QuizView = {
  id: string;
  title: string;
  topic: string | null;
  difficulty: "easy" | "medium" | "hard";
  kind: "quiz" | "practice_test";
  time_limit_s: number | null;
  status: string;
  origin: string;
  owner_id: string;
  owner_name: string;
  subject_name: string | null;
  subject_color: string | null;
  class_id: string | null;
  questions: number;
  best: number | null;
  attempts: number;
};

export function listQuizzes(db: Db, actor: Actor): QuizView[] {
  const v = visibilityClause(db, actor, "q");
  return db.all<QuizView>(
    `SELECT q.id, q.title, q.topic, q.difficulty, q.kind, q.time_limit_s, q.status, q.origin, q.owner_id, u.display_name owner_name,
            s.name subject_name, s.color subject_color, q.class_id,
            (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) questions,
            (SELECT MAX(score * 100 / total) FROM quiz_attempts a WHERE a.quiz_id = q.id AND a.student_id = ? AND total > 0) best,
            (SELECT COUNT(*) FROM quiz_attempts a WHERE a.quiz_id = q.id AND a.student_id = ?) attempts
     FROM quizzes q JOIN users u ON u.id = q.owner_id LEFT JOIN subjects s ON s.id = q.subject_id
     WHERE ${v.sql} ORDER BY q.created_at DESC`,
    actor.id,
    actor.id,
    ...v.params,
  );
}

function loadQuiz(db: Db, actor: Actor, quizId: string) {
  const v = visibilityClause(db, actor, "q");
  const quiz = db.get<QuizView & { document_id: string | null; subject_id: string | null }>(
    `SELECT q.*, u.display_name owner_name, s.name subject_name, s.color subject_color, 0 questions, NULL best, 0 attempts
     FROM quizzes q JOIN users u ON u.id = q.owner_id LEFT JOIN subjects s ON s.id = q.subject_id WHERE q.id = ? AND ${v.sql}`,
    quizId,
    ...v.params,
  );
  if (!quiz) throw notFound("Quiz not found.");
  return quiz;
}

/**
 * Questions for taking a quiz. Correct answers and explanations are NOT
 * included; they are only revealed by `submitAttempt` after grading.
 */
export function getQuizForTaking(db: Db, actor: Actor, quizId: string) {
  const quiz = loadQuiz(db, actor, quizId);
  const questions = db
    .all<{ id: string; type: QuestionInput["type"]; prompt: string; options: string; topic: string | null }>(
      `SELECT id, type, prompt, options, topic FROM quiz_questions WHERE quiz_id = ? ORDER BY position`,
      quizId,
    )
    .map((q) => ({ ...q, options: q.type === "true_false" ? ["True", "False"] : json<string[]>(q.options, []) }));
  return { quiz, questions };
}

/** Full quiz including answers — only for the owner (e.g. a teacher reviewing a draft). */
export function getQuizForEditing(db: Db, actor: Actor, quizId: string) {
  const quiz = loadQuiz(db, actor, quizId);
  if (quiz.owner_id !== actor.id) throw forbidden();
  const questions = db
    .all<{ id: string; type: QuestionInput["type"]; prompt: string; options: string; answer: string; explanation: string; topic: string | null }>(
      `SELECT id, type, prompt, options, answer, explanation, topic FROM quiz_questions WHERE quiz_id = ? ORDER BY position`,
      quizId,
    )
    .map((q) => ({ ...q, options: json<string[]>(q.options, []) }));
  return { quiz, questions };
}

export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.,=+\-/ ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCorrect(q: { type: string; answer: string }, given: string | undefined): boolean {
  if (given == null) return false;
  if (q.type === "short") {
    const accepted = q.answer.split("|").map(normalizeAnswer).filter(Boolean);
    return accepted.includes(normalizeAnswer(given));
  }
  return normalizeAnswer(q.answer) === normalizeAnswer(given);
}

export function xpForAttempt(score: number, total: number, difficulty: "easy" | "medium" | "hard"): number {
  if (total <= 0) return 0;
  const mult = { easy: 1, medium: 1.25, hard: 1.5 }[difficulty];
  const perfect = score === total ? 10 : 0;
  return Math.round((10 + score * 3) * mult) + perfect;
}

export function submitAttempt(db: Db, actor: Actor, quizId: string, answers: Record<string, string>, durationS?: number, now = new Date()) {
  assertCan(actor, "study.use");
  const quiz = loadQuiz(db, actor, quizId);
  const questions = db.all<{ id: string; type: string; prompt: string; options: string; answer: string; explanation: string; topic: string | null }>(
    `SELECT id, type, prompt, options, answer, explanation, topic FROM quiz_questions WHERE quiz_id = ? ORDER BY position`,
    quizId,
  );
  if (!questions.length) throw conflict("This quiz has no questions.");
  const results = questions.map((q) => {
    const given = typeof answers[q.id] === "string" ? answers[q.id]!.slice(0, 500) : undefined;
    return {
      questionId: q.id,
      prompt: q.prompt,
      type: q.type,
      given: given ?? null,
      correctAnswer: q.type === "short" ? q.answer.split("|")[0]! : q.answer,
      correct: isCorrect(q, given),
      explanation: q.explanation,
      topic: q.topic,
    };
  });
  const score = results.filter((r) => r.correct).length;
  const total = results.length;
  const revisionTopics = [...new Set(results.filter((r) => !r.correct && r.topic).map((r) => r.topic!))];
  if (actor.role !== "student") {
    // Teachers can preview their quizzes; previews are not recorded.
    return { attemptId: null, score, total, xp: 0, results, revisionTopics, preview: true };
  }
  return db.tx(() => {
    const attemptId = newId("att_");
    // XP is computed here from the graded result; the client never supplies it.
    const xp = grantXp(db, {
      userId: actor.id,
      amount: xpForAttempt(score, total, quiz.difficulty),
      reason: `${quiz.kind === "practice_test" ? "Practice test" : "Quiz"}: ${quiz.title} (${score}/${total})`,
      sourceType: "quiz",
      sourceId: quizId,
      // One XP award per quiz per student per day — retakes are welcome but not farmable.
      key: `quiz:${quizId}:${actor.id}:${isoDate(now)}`,
    });
    db.run(
      `INSERT INTO quiz_attempts (id, quiz_id, student_id, score, total, answers, duration_s, xp_awarded) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      attemptId,
      quizId,
      actor.id,
      score,
      total,
      JSON.stringify(answers),
      durationS && durationS > 0 ? Math.round(durationS) : null,
      xp,
    );
    recordProgress(db, actor.id, "quiz_completed", 1, now);
    evaluateAchievements(db, actor.id);
    return { attemptId, score, total, xp, results, revisionTopics, preview: false };
  });
}

export function validateQuestions(questions: QuestionInput[]): QuestionInput[] {
  if (!questions.length) throw invalid("Add at least one question.");
  if (questions.length > 60) throw invalid("A quiz can have at most 60 questions.");
  return questions.map((q, i) => {
    const prompt = q.prompt?.trim();
    if (!prompt) throw invalid(`Question ${i + 1} needs a prompt.`);
    if (!["mcq", "true_false", "short"].includes(q.type)) throw invalid(`Question ${i + 1} has an unknown type.`);
    let answer = q.answer?.trim();
    const options = q.type === "mcq" ? (q.options ?? []).map((o) => o.trim()).filter(Boolean) : [];
    if (q.type === "mcq") {
      if (options.length < 2) throw invalid(`Question ${i + 1} needs at least two options.`);
      if (!options.includes(answer)) throw invalid(`Question ${i + 1}: the answer must be one of the options.`);
    }
    if (q.type === "true_false") {
      answer = /^t/i.test(answer) ? "True" : "False";
    }
    if (!answer) throw invalid(`Question ${i + 1} needs an answer.`);
    return { type: q.type, prompt: prompt.slice(0, 1000), options, answer: answer.slice(0, 300), explanation: (q.explanation ?? "").trim().slice(0, 2000) || "No explanation provided.", topic: q.topic?.trim().slice(0, 80) };
  });
}

export function createQuiz(
  db: Db,
  actor: Actor,
  input: {
    title: string;
    topic?: string;
    subjectId?: string | null;
    classId?: string | null;
    documentId?: string | null;
    difficulty: "easy" | "medium" | "hard";
    kind?: "quiz" | "practice_test";
    timeLimitS?: number | null;
    origin: "manual" | "ai" | "simulated";
    questions: QuestionInput[];
  },
) {
  assertCan(actor, "study.use");
  const title = input.title.trim();
  if (title.length < 2 || title.length > 140) throw invalid("Title must be 2–140 characters.");
  const questions = validateQuestions(input.questions);
  let classId: string | null = null;
  let status: "draft" | "published" = "published";
  if (actor.role === "teacher") {
    if (input.classId) {
      if (!teacherTeaches(db, actor.id, input.classId)) throw forbidden();
      classId = input.classId;
    }
    status = "draft";
  }
  const id = newId("qz_");
  db.tx(() => {
    db.run(
      `INSERT INTO quizzes (id, owner_id, class_id, subject_id, document_id, title, topic, difficulty, kind, time_limit_s, status, origin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      actor.id,
      classId,
      input.subjectId ?? null,
      input.documentId ?? null,
      title,
      input.topic?.slice(0, 120) ?? null,
      input.difficulty,
      input.kind ?? "quiz",
      input.timeLimitS ?? null,
      status,
      input.origin,
    );
    questions.forEach((q, i) =>
      db.run(
        `INSERT INTO quiz_questions (id, quiz_id, position, type, prompt, options, answer, explanation, topic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        newId("qq_"),
        id,
        i,
        q.type,
        q.prompt,
        JSON.stringify(q.options ?? []),
        q.answer,
        q.explanation,
        q.topic ?? null,
      ),
    );
  });
  return id;
}

export function replaceQuizQuestions(db: Db, actor: Actor, quizId: string, input: { title: string; questions: QuestionInput[] }) {
  const q = db.get<{ owner_id: string }>(`SELECT owner_id FROM quizzes WHERE id = ?`, quizId);
  if (!q || q.owner_id !== actor.id) throw forbidden();
  const questions = validateQuestions(input.questions);
  db.tx(() => {
    db.run(`UPDATE quizzes SET title = ? WHERE id = ?`, input.title.trim().slice(0, 140) || "Untitled quiz", quizId);
    db.run(`DELETE FROM quiz_questions WHERE quiz_id = ?`, quizId);
    questions.forEach((x, i) =>
      db.run(
        `INSERT INTO quiz_questions (id, quiz_id, position, type, prompt, options, answer, explanation, topic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        newId("qq_"),
        quizId,
        i,
        x.type,
        x.prompt,
        JSON.stringify(x.options ?? []),
        x.answer,
        x.explanation,
        x.topic ?? null,
      ),
    );
  });
}

/** Teacher publishes reviewed content to a class. AI content never auto-publishes. */
export function publishContent(db: Db, actor: Actor, kind: "quiz" | "flashcards", id: string, classId: string) {
  assertCan(actor, "content.publish");
  if (!teacherTeaches(db, actor.id, classId)) throw forbidden();
  const table = kind === "quiz" ? "quizzes" : "flashcard_sets";
  const row = db.get<{ owner_id: string }>(`SELECT owner_id FROM ${table} WHERE id = ?`, id);
  if (!row || row.owner_id !== actor.id) throw forbidden();
  db.run(`UPDATE ${table} SET status = 'published', class_id = ? WHERE id = ?`, classId, id);
  const students = db.all<{ user_id: string }>(
    `SELECT cm.user_id FROM class_memberships cm JOIN users u ON u.id = cm.user_id WHERE cm.class_id = ? AND u.role = 'student'`,
    classId,
  );
  return students.length;
}

export function deleteOwnContent(db: Db, actor: Actor, kind: "quiz" | "flashcards", id: string) {
  const table = kind === "quiz" ? "quizzes" : "flashcard_sets";
  const row = db.get<{ owner_id: string }>(`SELECT owner_id FROM ${table} WHERE id = ?`, id);
  if (!row || row.owner_id !== actor.id) throw forbidden();
  db.run(`DELETE FROM ${table} WHERE id = ?`, id);
}

export function recentAttempts(db: Db, actor: Actor, limit = 8) {
  return db.all<{ id: string; quiz_id: string; title: string; score: number; total: number; xp_awarded: number; completed_at: string; subject_name: string | null; subject_color: string | null }>(
    `SELECT a.id, a.quiz_id, q.title, a.score, a.total, a.xp_awarded, a.completed_at, s.name subject_name, s.color subject_color
     FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id LEFT JOIN subjects s ON s.id = q.subject_id
     WHERE a.student_id = ? ORDER BY a.completed_at DESC LIMIT ?`,
    actor.id,
    limit,
  );
}
