import { useSyncExternalStore } from "react";
import type { MLCEngine } from "@mlc-ai/web-llm";
import { z } from "zod";
import {
  aiSourceAction,
  generateFlashcardsAction,
  generateQuizAction,
  generateSummaryAction,
  homeworkContextAction,
  homeworkHelpAction,
  studyPlanAction,
  studyPlanInputAction,
} from "@/actions/ai";
import { GENERATOR_SYSTEM, TUTOR_SYSTEM, flashcardPrompt, homeworkPrompt, planPrompt, quizPrompt, summaryPrompt, tutorUserContent } from "./prompts";
import type { SourceSpec } from "../domain/ai-service";
import {
  BROWSER_MODEL_LABEL,
  FlashcardsSchema,
  HomeworkSchema,
  QuizSchema,
  StudyPlanSchema,
  SummarySchema,
  clampFlashcardCount,
  clampQuizOptions,
  cleanQuizQuestions,
  type AiProvider,
  type QuizOptions,
  type SummaryOptions,
  type TutorLevel,
} from "./types";

/**
 * On-device AI: an open model (Qwen3 1.7B) runs in the visitor's browser on
 * their GPU via WebLLM. No API key, no tokens, nothing sent to an AI company.
 * The weights (~1 GB) download once and are cached by the browser.
 * Devices without WebGPU fall back to the server's labelled simulator.
 */

// The model has a 4k-token context: keep prompts well inside it.
const MAX_SOURCE_CHARS = 6000;
const MAX_EXCERPT_CHARS = 900;

// ── Engine state, shared by every component on the page ─────────────────────

export type BrowserAiState = { status: "checking" | "unsupported" | "idle" | "loading" | "ready" | "error"; progress: number; text: string };

let state: BrowserAiState = { status: "checking", progress: 0, text: "" };
const listeners = new Set<() => void>();
const set = (s: Partial<BrowserAiState>) => {
  state = { ...state, ...s };
  listeners.forEach((l) => l());
};

type Gpu = { requestAdapter(): Promise<{ features: ReadonlySet<string> } | null> };
const gpu = () => (typeof navigator === "undefined" ? undefined : (navigator as Navigator & { gpu?: Gpu }).gpu);

let modelId: Promise<string | null> | undefined;
/** The f16 build is smaller and faster; older GPUs without shader-f16 need the f32 build. */
function pickModel() {
  modelId ??= (async () => {
    const adapter = await gpu()?.requestAdapter().catch(() => null);
    if (!adapter) return null;
    return adapter.features.has("shader-f16") ? "Qwen3-1.7B-q4f16_1-MLC" : "Qwen3-1.7B-q4f32_1-MLC";
  })();
  return modelId;
}

let checked = false;
async function check() {
  if (checked) return;
  checked = true;
  const id = await pickModel();
  if (!id) return set({ status: "unsupported" });
  set({ status: "idle" });
  // Already downloaded on this device → load straight away, no prompt needed.
  const { hasModelInCache } = await import("@mlc-ai/web-llm");
  if (await hasModelInCache(id).catch(() => false)) void loadBrowserAi();
}

let engine: Promise<MLCEngine> | undefined;
export function loadBrowserAi() {
  engine ??= (async () => {
    const id = await pickModel();
    if (!id) throw new Error("WebGPU is not available on this device.");
    set({ status: "loading", progress: 0, text: "Starting…" });
    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
    // shortcut: runs on the page's main thread (GPU work is async, UI stays usable); move to a Web Worker if typing ever stutters.
    const e = await CreateMLCEngine(id, { initProgressCallback: (r) => set({ progress: r.progress, text: r.text }) });
    set({ status: "ready", progress: 1, text: "" });
    return e;
  })();
  engine.catch((err) => {
    console.error("[browser-ai] load failed", err);
    engine = undefined;
    set({ status: "error", text: err instanceof Error ? err.message : "The model could not be loaded." });
  });
  return engine;
}

export function useBrowserAi(): BrowserAiState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      void check();
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

export const browserAiReady = () => state.status === "ready";

// ── The provider: same interface and prompts the server providers use ───────

const NO_THINKING = { enable_thinking: false };

async function generate<T>(schema: z.ZodType<T>, prompt: string, maxTokens = 1400): Promise<T> {
  const e = await loadBrowserAi();
  const r = await e.chat.completions.create({
    messages: [
      { role: "system", content: GENERATOR_SYSTEM },
      { role: "user", content: prompt },
    ],
    // Grammar-constrained decoding: the model can only emit JSON matching the schema.
    response_format: { type: "json_object", schema: JSON.stringify(z.toJSONSchema(schema)) },
    max_tokens: maxTokens,
    temperature: 0.4,
    extra_body: NO_THINKING,
  });
  return schema.parse(JSON.parse(r.choices[0]?.message.content ?? ""));
}

const trimSource = (t: string) => t.slice(0, MAX_SOURCE_CHARS);
const trimChunks = <C extends { content: string }>(cs: C[]) => cs.map((c) => ({ ...c, content: c.content.slice(0, MAX_EXCERPT_CHARS) }));

export const browserProvider: AiProvider = {
  id: "browser",
  label: BROWSER_MODEL_LABEL,
  simulated: false,

  async *tutor(input, signal) {
    const e = await loadBrowserAi();
    const stream = await e.chat.completions.create({
      stream: true,
      messages: [
        { role: "system", content: TUTOR_SYSTEM },
        ...input.history.slice(-6).map((t) => ({ role: t.role, content: t.content.slice(0, 1200) })),
        { role: "user", content: tutorUserContent({ ...input, sources: trimChunks(input.sources).slice(0, 3) }) },
      ],
      max_tokens: 900,
      temperature: 0.6,
      extra_body: NO_THINKING,
    });
    for await (const chunk of stream) {
      if (signal?.aborted) {
        e.interruptGenerate();
        return;
      }
      const d = chunk.choices[0]?.delta?.content;
      if (d) yield d;
    }
  },

  summarize: (text, title, opts) => generate(SummarySchema, summaryPrompt(trimSource(text), title, opts)),

  async flashcards(text, title, count) {
    const r = await generate(FlashcardsSchema, flashcardPrompt(trimSource(text), title, count));
    return r.cards.filter((c) => c.front.trim() && c.back.trim()).slice(0, count);
  },

  async quiz(text, title, opts) {
    const r = await generate(QuizSchema, quizPrompt(trimSource(text), title, opts), 1800);
    return cleanQuizQuestions(r.questions, opts).slice(0, opts.count);
  },

  studyPlan: (input) => generate(StudyPlanSchema, planPrompt(input)),

  homework(question, context, level) {
    const excerpts = trimChunks(context)
      .map((c, i) => `[S${i + 1}] ${c.documentTitle}: ${c.content}`)
      .join("\n\n");
    return generate(HomeworkSchema, homeworkPrompt(question.slice(0, 3000), excerpts, level));
  },
};

// ── Drop-in replacements for the server actions the AI tools call ───────────
// When the on-device model is ready they use it; otherwise they call the
// original server action (the labelled simulator), so every tool keeps working.

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function local<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    console.error("[browser-ai]", err);
    return { ok: false, error: "The on-device AI couldn't finish this. Try again, or use a shorter source." };
  }
}

const meta = { simulated: false, provider: BROWSER_MODEL_LABEL };

export async function generateSummary(source: SourceSpec, opts: SummaryOptions) {
  if (!browserAiReady()) return generateSummaryAction(source, opts);
  const ctx = await aiSourceAction(source);
  if (!ctx.ok) return ctx;
  const { text, title } = ctx.data;
  return local(async () => ({ summary: await browserProvider.summarize(text, title, opts), sourceTitle: title, ...meta }));
}

export async function generateFlashcards(source: SourceSpec, count: number) {
  if (!browserAiReady()) return generateFlashcardsAction(source, count);
  const ctx = await aiSourceAction(source);
  if (!ctx.ok) return ctx;
  const { text, title, documentId, subjectId } = ctx.data;
  const res = await local(() => browserProvider.flashcards(text, title, clampFlashcardCount(count)));
  if (!res.ok) return res;
  if (!res.data.length) return { ok: false as const, error: "Not enough suitable content was found to make flashcards from this source." };
  return { ok: true as const, data: { cards: res.data, sourceTitle: title, documentId, subjectId, ...meta } };
}

export async function generateQuiz(source: SourceSpec, opts: QuizOptions) {
  if (!browserAiReady()) return generateQuizAction(source, opts);
  const ctx = await aiSourceAction(source);
  if (!ctx.ok) return ctx;
  const { text, title, documentId, subjectId } = ctx.data;
  const res = await local(() => browserProvider.quiz(text, title, clampQuizOptions(opts)));
  if (!res.ok) return res;
  if (!res.data.length) return { ok: false as const, error: "The AI couldn't build valid questions from this source. Try again or pick another source." };
  return { ok: true as const, data: { questions: res.data, sourceTitle: title, documentId, subjectId, ...meta } };
}

export async function studyPlan(days: number, minutesPerDay: number) {
  if (!browserAiReady()) return studyPlanAction(days, minutesPerDay);
  const ctx = await studyPlanInputAction(days, minutesPerDay);
  if (!ctx.ok) return ctx;
  return local(async () => ({ plan: await browserProvider.studyPlan(ctx.data), ...meta }));
}

export async function homeworkHelp(question: string, level: TutorLevel, documentId: string | null) {
  if (!browserAiReady()) return homeworkHelpAction(question, level, documentId);
  const ctx = await homeworkContextAction(question, documentId);
  if (!ctx.ok) return ctx;
  const lv: TutorLevel = level === "simpler" || level === "advanced" ? level : "standard";
  return local(async () => ({ help: await browserProvider.homework(ctx.data.question, ctx.data.chunks, lv), sources: ctx.data.sources, ...meta }));
}
