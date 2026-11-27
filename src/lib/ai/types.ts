import { z } from "zod";
import type { RetrievedChunk } from "./retrieval";

/**
 * Provider-neutral AI task interface. Each provider (the on-device browser model, the
 * rule-based simulator, or a future one) implements these tasks; the rest
 * of the application never imports a provider SDK directly.
 */

export const SummarySchema = z.object({
  title: z.string(),
  overview: z.string(),
  keyPoints: z.array(z.string()),
  keyConcepts: z.array(z.object({ term: z.string(), explanation: z.string() })),
  definitions: z.array(z.object({ term: z.string(), definition: z.string() })),
  formulas: z.array(z.string()),
  importantDates: z.array(z.string()),
});
export type Summary = z.infer<typeof SummarySchema>;

export const FlashcardsSchema = z.object({
  cards: z.array(z.object({ front: z.string(), back: z.string() })),
});

export const QuizSchema = z.object({
  questions: z.array(
    z.object({
      type: z.enum(["mcq", "true_false", "short"]),
      prompt: z.string(),
      options: z.array(z.string()),
      answer: z.string(),
      explanation: z.string(),
      topic: z.string(),
    }),
  ),
});
export type GeneratedQuestion = z.infer<typeof QuizSchema>["questions"][number];

export const StudyPlanSchema = z.object({
  intro: z.string(),
  days: z.array(
    z.object({
      day: z.string(),
      focus: z.string(),
      tasks: z.array(z.object({ activity: z.string(), minutes: z.number(), why: z.string() })),
    }),
  ),
  note: z.string(),
});
export type StudyPlan = z.infer<typeof StudyPlanSchema>;

export const HomeworkSchema = z.object({
  understanding: z.string(),
  concepts: z.array(z.string()),
  steps: z.array(z.object({ title: z.string(), guidance: z.string(), check: z.string() })),
  finalHint: z.string(),
  selfCheck: z.string(),
});
export type HomeworkHelp = z.infer<typeof HomeworkSchema>;

export const GeneratedCourseSchema = z.object({
  title: z.string(),
  summary: z.string(),
  skills: z.array(z.string()),
  lessons: z.array(z.object({ title: z.string(), body: z.string() })),
  quiz: z.array(z.object({ prompt: z.string(), options: z.array(z.string()), answer: z.string() })),
});
export type GeneratedCourse = z.infer<typeof GeneratedCourseSchema>;

/** Keep only usable lessons and questions; throws if too little is left to be a course. */
export function cleanGeneratedCourse(c: GeneratedCourse): GeneratedCourse {
  const t = (s: string, n: number) => s.trim().slice(0, n);
  const lessons = c.lessons.map((l) => ({ title: t(l.title, 120), body: t(l.body, 6000) })).filter((l) => l.title && l.body.length >= 80).slice(0, 6);
  const quiz = c.quiz
    .map((q) => ({ prompt: t(q.prompt, 300), options: [...new Set(q.options.map((o) => t(o, 200)).filter(Boolean))].slice(0, 5), answer: t(q.answer, 200) }))
    .filter((q) => q.prompt && q.options.length >= 2 && q.options.includes(q.answer))
    .slice(0, 10);
  if (lessons.length < 2 || quiz.length < 3) throw new Error("AI returned an incomplete course.");
  return { title: t(c.title, 120) || "Untitled course", summary: t(c.summary, 300), skills: c.skills.map((s) => t(s, 40)).filter(Boolean).slice(0, 5), lessons, quiz };
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type TutorLevel = "simpler" | "standard" | "advanced";

export type TutorInput = {
  question: string;
  history: ChatTurn[];
  sources: RetrievedChunk[];
  grounded: boolean;
  level: TutorLevel;
  studentName: string;
};

export type SummaryOptions = { length: "concise" | "detailed"; format: "notes" | "chapter" | "revision" };

export type QuizOptions = { count: number; difficulty: "easy" | "medium" | "hard"; types: ("mcq" | "true_false" | "short")[]; topic?: string };

export type PlanInput = {
  studentName: string;
  days: number;
  minutesPerDay: number;
  subjects: { name: string; average: number | null; trend: number | null; upcoming: string[] }[];
  materials: { title: string; subject: string | null }[];
};

/**
 * Facts a recommendation letter may draw on. Deliberately contains no name:
 * the letter says "[Student]" and the server fills the name in afterwards,
 * so personal names never reach an external AI service.
 */
export type RecommendationInput = {
  purpose: "university" | "scholarship" | "volunteering" | "course";
  /** Set when the letter accredits a teacher-reviewed course (purpose "course"). */
  course?: { title: string; skills: string[]; score: number | null; lessons: string[] };
  recipient: string | null;
  teacherRole: string;
  monthsKnown: number;
  volunteering: { title: string; hours: number }[];
  totalHours: number;
  badges: string[];
  courses: string[];
  projects: { title: string; description: string; verified: boolean }[];
  average: number | null;
  attendancePct: number | null;
};

/**
 * What the snow-leopard companion knows about the student right now. First
 * name only; no grades, attendance or support data, so it never pressures
 * or judges.
 */
export type CompanionContext = {
  firstName: string;
  localTime: string;
  level: number;
  levelTitle: string;
  streakDays: number;
  activeToday: boolean;
  homework: { title: string; subject: string; due: string; overdue: boolean }[];
  nextClass: { subject: string; when: string } | null;
  course: { title: string; lessonsDone: number; lessons: number } | null;
};

export type CompanionInput = { message: string; history: ChatTurn[]; context: CompanionContext };

export interface AiProvider {
  readonly id: "cloud" | "browser" | "simulated";
  readonly label: string;
  readonly simulated: boolean;
  tutor(input: TutorInput, signal?: AbortSignal): AsyncIterable<string>;
  summarize(text: string, title: string, opts: SummaryOptions): Promise<Summary>;
  flashcards(text: string, title: string, count: number): Promise<{ front: string; back: string }[]>;
  quiz(text: string, title: string, opts: QuizOptions): Promise<GeneratedQuestion[]>;
  studyPlan(input: PlanInput): Promise<StudyPlan>;
  homework(question: string, context: RetrievedChunk[], level: TutorLevel): Promise<HomeworkHelp>;
  /** Plain-text recommendation letter draft for a teacher to edit. Server-side providers only. */
  recommendation?(input: RecommendationInput): Promise<string>;
  /** A short course (lessons + quiz) on a topic, for a teacher to review. Server-side providers only. */
  course?(topic: string): Promise<GeneratedCourse>;
  /** Irbis, the snow-leopard study companion: short, warm, streamed replies. Server-side providers only. */
  companion?(input: CompanionInput, signal?: AbortSignal): AsyncIterable<string>;
}

/** Shown wherever the on-device model is named. */
export const BROWSER_MODEL_LABEL = "Qwen3 1.7B (on-device)";

export const clampFlashcardCount = (count: number) => Math.max(3, Math.min(30, Math.round(Number(count) || 10)));

/** Small models sometimes break the answer rules; drop those questions rather than save broken ones. */
export function cleanQuizQuestions(questions: GeneratedQuestion[], opts: Pick<QuizOptions, "types">): GeneratedQuestion[] {
  return questions
    .filter((q) => opts.types.includes(q.type))
    .map((q) => (q.type === "true_false" ? { ...q, options: ["True", "False"] } : q.type === "short" ? { ...q, options: [] } : q))
    .filter((q) => q.prompt.trim() && q.answer.trim())
    .filter((q) => q.type !== "mcq" || (new Set(q.options).size >= 2 && q.options.includes(q.answer)))
    .filter((q) => q.type !== "true_false" || q.answer === "True" || q.answer === "False");
}

export function clampQuizOptions(opts: QuizOptions): QuizOptions {
  const types = (opts.types ?? []).filter((t) => ["mcq", "true_false", "short"].includes(t));
  return {
    count: Math.max(3, Math.min(25, Math.round(Number(opts.count) || 6))),
    difficulty: ["easy", "medium", "hard"].includes(opts.difficulty) ? opts.difficulty : "medium",
    types: types.length ? types : ["mcq"],
    topic: opts.topic ? String(opts.topic).slice(0, 120) : undefined,
  };
}

export class AiUnavailableError extends Error {
  constructor(message = "AI is not configured for this deployment.") {
    super(message);
    this.name = "AiUnavailableError";
  }
}
