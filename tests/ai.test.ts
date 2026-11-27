import { beforeEach, describe, expect, it } from "vitest";
import { actor, seededDb } from "./support/db";
import type { Db } from "../src/lib/db/client";
import { simulatedProvider } from "../src/lib/ai/simulated";
import { cleanQuizQuestions, type GeneratedQuestion } from "../src/lib/ai/types";
import { consumeAiQuota, generateQuiz, prepareTutorTurn } from "../src/lib/domain/ai-service";
import { documentText } from "../src/lib/domain/documents";
import { validateQuestions } from "../src/lib/domain/study";

let db: Db;
beforeEach(() => {
  db = seededDb();
});

async function collect(it: AsyncIterable<string>) {
  let s = "";
  for await (const x of it) s += x;
  return s;
}

describe("tutor grounding", () => {
  it("grounds lesson questions in the teacher's materials", () => {
    const t = prepareTutorTurn(db, actor(db, "usr_alex"), { message: "Why do leaves look green? What does chlorophyll do?", level: "standard" });
    expect(t.grounded).toBe(true);
    expect(t.sources[0]!.documentId).toBe("doc_photosynthesis");
  });

  it("says when the materials don't cover a question", async () => {
    const alex = actor(db, "usr_alex");
    const t = prepareTutorTurn(db, alex, { message: "Who won the basketball championship last season?", level: "standard" });
    expect(t.grounded).toBe(false);
    const text = await collect(simulatedProvider.tutor({ question: "x", history: [], sources: t.sources, grounded: t.grounded, level: "standard", studentName: "Alex" }));
    expect(text).toMatch(/couldn't find this topic/i);
  });

  it("persists the conversation for the student only", () => {
    const t = prepareTutorTurn(db, actor(db, "usr_alex"), { message: "Explain Newton's second law", level: "simpler" });
    expect(db.get<{ user_id: string }>(`SELECT user_id FROM ai_conversations WHERE id = ?`, t.conversationId)!.user_id).toBe("usr_alex");
    expect(() => prepareTutorTurn(db, actor(db, "usr_maya"), { conversationId: t.conversationId, message: "hi", level: "standard" })).toThrow();
  });
});

describe("simulated provider (rule-based, labelled)", () => {
  it("summarises real lesson text", async () => {
    const { text } = documentText(db, actor(db, "usr_alex"), "doc_photosynthesis");
    const s = await simulatedProvider.summarize(text, "Photosynthesis", { length: "concise", format: "notes" });
    expect(s.overview.length).toBeGreaterThan(40);
    expect(s.keyPoints.length).toBeGreaterThan(0);
    expect(s.definitions.some((d) => /photosynthesis/i.test(d.term))).toBe(true);
    expect(s.formulas.some((f) => f.includes("6CO2"))).toBe(true);
  });

  it("generates valid quiz questions from a lesson", async () => {
    const alex = actor(db, "usr_alex");
    const r = await generateQuiz(db, alex, simulatedProvider, { documentId: "doc_newton" }, { count: 6, difficulty: "medium", types: ["mcq", "true_false", "short"] });
    expect(r.simulated).toBe(true);
    expect(r.questions.length).toBeGreaterThanOrEqual(3);
    expect(() => validateQuestions(r.questions)).not.toThrow();
  });

  it("creates flashcards from definitions", async () => {
    const { text } = documentText(db, actor(db, "usr_alex"), "doc_bonding");
    const cards = await simulatedProvider.flashcards(text, "Chemical bonding", 6);
    expect(cards.length).toBeGreaterThanOrEqual(3);
    expect(cards.every((c) => c.front && c.back)).toBe(true);
  });
});

describe("usage controls", () => {
  it("enforces the daily AI request limit", () => {
    const alex = actor(db, "usr_alex");
    consumeAiQuota(db, alex, 2);
    consumeAiQuota(db, alex, 2);
    expect(() => consumeAiQuota(db, alex, 2)).toThrow(/limit/);
  });
});

describe("on-device quiz output cleanup", () => {
  const q = (o: Partial<GeneratedQuestion>): GeneratedQuestion => ({ type: "mcq", prompt: "Q?", options: ["a", "b", "c", "d"], answer: "a", explanation: "", topic: "t", ...o });

  it("keeps valid questions and drops ones that break the answer rules", () => {
    const out = cleanQuizQuestions(
      [
        q({}),
        q({ answer: "z" }), // mcq answer not among options
        q({ options: ["a", "a"], answer: "a" }), // duplicate options
        q({ type: "true_false", options: [], answer: "True" }), // options get fixed
        q({ type: "true_false", answer: "Maybe" }),
        q({ type: "short", options: ["x"], answer: "photosynthesis" }),
        q({ prompt: "  " }),
      ],
      { types: ["mcq", "true_false", "short"] },
    );
    expect(out.map((x) => x.type)).toEqual(["mcq", "true_false", "short"]);
    expect(out[1]!.options).toEqual(["True", "False"]);
    expect(out[2]!.options).toEqual([]);
    expect(validateQuestions(out)).toBeTruthy();
  });

  it("drops question types that were not requested", () => {
    expect(cleanQuizQuestions([q({ type: "short", options: [], answer: "x" })], { types: ["mcq"] })).toEqual([]);
  });
});
