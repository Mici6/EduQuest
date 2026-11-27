import "server-only";
import { z } from "zod";
import { DomainError } from "../auth/errors";
import { cloudConfig, cloudEndpoints } from "../config/env";
import { COMPANION_SYSTEM, companionUserContent, COURSE_SYSTEM, coursePrompt, GENERATOR_SYSTEM, RECOMMENDATION_SYSTEM, TUTOR_SYSTEM, recommendationPrompt, flashcardPrompt, homeworkPrompt, planPrompt, quizPrompt, summaryPrompt, tutorUserContent } from "./prompts";
import { FlashcardsSchema, GeneratedCourseSchema, cleanGeneratedCourse, HomeworkSchema, QuizSchema, StudyPlanSchema, SummarySchema, cleanQuizQuestions, type AiProvider } from "./types";

/**
 * Cloud AI over the OpenAI-compatible Chat Completions API, which Groq,
 * Google Gemini, OpenRouter, OpenAI and others all speak. Defaults to Groq's
 * free tier. The key is read on the server only and never sent to the browser.
 */

// Free tiers cap tokens per minute, so keep source text modest.
const MAX_SOURCE_CHARS = 12_000;

type Message = { role: "system" | "user" | "assistant"; content: string };

/**
 * Send a chat request, trying each configured endpoint in turn: if the
 * primary is rate-limited, erroring or unreachable, the fallback answers.
 * "chat" requests (the tutor) may use a smaller per-endpoint chat model.
 */
async function chat(body: Record<string, unknown>, signal?: AbortSignal, use: "chat" | "task" = "task"): Promise<Response> {
  let limited = false;
  let lastError: unknown;
  for (const ep of cloudEndpoints()) {
    try {
      const res = await fetch(`${ep.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ep.apiKey}` },
        body: JSON.stringify({ model: use === "chat" ? ep.chatModel : ep.model, ...body }),
        signal,
      });
      if (res.ok) return res;
      limited ||= res.status === 429;
      lastError = new Error(`AI service (${ep.name}) returned ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
    } catch (err) {
      if (signal?.aborted) throw err;
      lastError = err;
    }
    console.warn("[ai] endpoint failed, trying the next one", lastError);
  }
  if (limited) throw new DomainError("The free AI service is busy (its per-minute limit was reached). Please try again in a minute.", "rate_limited");
  throw lastError;
}

/** Ask for JSON matching a Zod schema, then validate it (models can still slip). */
export async function generateJson<T>(schema: z.ZodType<T>, prompt: string, system = GENERATOR_SYSTEM): Promise<T> {
  const messages: Message[] = [
    { role: "system", content: `${system}\n\nReply with only a JSON object that matches this JSON Schema:\n${JSON.stringify(z.toJSONSchema(schema))}` },
    { role: "user", content: prompt },
  ];
  const res = await chat({ messages, response_format: { type: "json_object" }, temperature: 0.4, max_tokens: 4000 });
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = (data.choices?.[0]?.message?.content ?? "").replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "");
  return schema.parse(JSON.parse(text));
}

/** Yield text deltas from an OpenAI-style server-sent-events stream. */
export async function* streamDeltas(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const data = line.trim().replace(/^data:\s*/, "");
      if (!line.trim().startsWith("data:") || !data) continue;
      if (data === "[DONE]") return;
      const delta = (JSON.parse(data) as { choices?: { delta?: { content?: string | null } }[] }).choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}

export const cloudProvider: AiProvider = {
  id: "cloud",
  get label() {
    return cloudConfig().label;
  },
  simulated: false,

  async *tutor(input, signal) {
    const messages: Message[] = [
      { role: "system", content: TUTOR_SYSTEM },
      ...input.history.slice(-10).map((t) => ({ role: t.role, content: t.content })),
      { role: "user", content: tutorUserContent(input) },
    ];
    const res = await chat({ messages, stream: true, temperature: 0.6, max_tokens: 2000 }, signal, "chat");
    if (!res.body) throw new Error("AI service returned no stream.");
    yield* streamDeltas(res.body);
  },

  summarize: (text, title, opts) => generateJson(SummarySchema, summaryPrompt(text.slice(0, MAX_SOURCE_CHARS), title, opts)),

  async flashcards(text, title, count) {
    const r = await generateJson(FlashcardsSchema, flashcardPrompt(text.slice(0, MAX_SOURCE_CHARS), title, count));
    return r.cards.filter((c) => c.front.trim() && c.back.trim()).slice(0, count);
  },

  async quiz(text, title, opts) {
    const r = await generateJson(QuizSchema, quizPrompt(text.slice(0, MAX_SOURCE_CHARS), title, opts));
    return cleanQuizQuestions(r.questions, opts).slice(0, opts.count);
  },

  studyPlan: (input) => generateJson(StudyPlanSchema, planPrompt(input)),

  homework(question, context, level) {
    const excerpts = context.map((c, i) => `[S${i + 1}] ${c.documentTitle}: ${c.content}`).join("\n\n");
    return generateJson(HomeworkSchema, homeworkPrompt(question.slice(0, 8000), excerpts, level));
  },

  async recommendation(input) {
    const messages: Message[] = [
      { role: "system", content: RECOMMENDATION_SYSTEM },
      { role: "user", content: recommendationPrompt(input) },
    ];
    const res = await chat({ messages, temperature: 0.5, max_tokens: 2000 });
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = (data.choices?.[0]?.message?.content ?? "").trim();
    if (text.length < 200) throw new Error("AI returned an unusably short letter.");
    return text;
  },

  async *companion(input, signal) {
    const messages: Message[] = [
      { role: "system", content: COMPANION_SYSTEM },
      ...input.history.slice(-10).map((t) => ({ role: t.role, content: t.content })),
      { role: "user", content: companionUserContent(input) },
    ];
    const res = await chat({ messages, stream: true, temperature: 0.7, max_tokens: 600 }, signal, "chat");
    if (!res.body) throw new Error("AI service returned no stream.");
    yield* streamDeltas(res.body);
  },

  course: async (topic) => cleanGeneratedCourse(await generateJson(GeneratedCourseSchema, coursePrompt(topic), COURSE_SYSTEM)),
};
