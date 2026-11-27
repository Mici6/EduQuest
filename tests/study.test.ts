import { beforeEach, describe, expect, it } from "vitest";
import { actor, seededDb } from "./support/db";
import type { Db } from "../src/lib/db/client";
import { FLASHCARD_XP_DAILY_CAP, createQuiz, isCorrect, publishContent, reviewCard, submitAttempt, validateQuestions } from "../src/lib/domain/study";
import { xpTotal } from "../src/lib/domain/gamification";

let db: Db;
beforeEach(() => {
  db = seededDb();
});

const answersFor = (quizId: string) =>
  Object.fromEntries(db.all<{ id: string; answer: string }>(`SELECT id, answer FROM quiz_questions WHERE quiz_id = ?`, quizId).map((q) => [q.id, q.answer.split("|")[0]!]));

describe("quizzes", () => {
  it("grades on the server and awards XP computed from the result", () => {
    const alex = actor(db, "usr_alex");
    const before = xpTotal(db, alex.id);
    const r = submitAttempt(db, alex, "quiz_linear", answersFor("quiz_linear"));
    expect(r.score).toBe(r.total);
    expect(r.xp).toBe(Math.round((10 + r.total * 3) * 1.25) + 10);
    expect(xpTotal(db, alex.id)).toBeGreaterThanOrEqual(before + r.xp);
    expect(r.revisionTopics).toEqual([]);
  });

  it("awards quiz XP once per quiz per day, but still records retakes", () => {
    const alex = actor(db, "usr_alex");
    submitAttempt(db, alex, "quiz_linear", {});
    const again = submitAttempt(db, alex, "quiz_linear", answersFor("quiz_linear"));
    expect(again.xp).toBe(0);
    expect(db.get<{ c: number }>(`SELECT COUNT(*) c FROM quiz_attempts WHERE student_id = ? AND quiz_id = 'quiz_linear'`, alex.id)!.c).toBe(2);
  });

  it("returns explanations and revision topics for wrong answers", () => {
    const r = submitAttempt(db, actor(db, "usr_alex"), "quiz_photo", {});
    expect(r.score).toBe(0);
    expect(r.results.every((x) => x.explanation.length > 0)).toBe(true);
    expect(r.revisionTopics.length).toBeGreaterThan(0);
  });

  it("accepts short-answer alternatives with normalisation", () => {
    expect(isCorrect({ type: "short", answer: "Robespierre|Maximilien Robespierre" }, "  maximilien ROBESPIERRE ")).toBe(true);
    expect(isCorrect({ type: "short", answer: "terminal velocity|terminal speed" }, "Terminal speed")).toBe(true);
    expect(isCorrect({ type: "short", answer: "starch" }, "glucose")).toBe(false);
  });

  it("teacher previews are graded but not recorded", () => {
    const r = submitAttempt(db, actor(db, "usr_novak"), "quiz_draft_gradients", {});
    expect(r.preview).toBe(true);
    expect(db.get<{ c: number }>(`SELECT COUNT(*) c FROM quiz_attempts WHERE student_id = 'usr_novak'`)!.c).toBe(0);
  });

  it("validates generated questions", () => {
    expect(() => validateQuestions([{ type: "mcq", prompt: "Q?", options: ["a", "b"], answer: "c", explanation: "" }])).toThrow(/one of the options/);
    expect(validateQuestions([{ type: "true_false", prompt: "Q?", answer: "true", explanation: "" }])[0]!.answer).toBe("True");
  });

  it("keeps teacher content as a draft until it is published", () => {
    const novak = actor(db, "usr_novak");
    const id = createQuiz(db, novak, { title: "New quiz", difficulty: "easy", origin: "simulated", questions: [{ type: "true_false", prompt: "2 + 2 = 4", answer: "True", explanation: "Arithmetic" }] });
    expect(db.get<{ status: string }>(`SELECT status FROM quizzes WHERE id = ?`, id)!.status).toBe("draft");
    expect(() => submitAttempt(db, actor(db, "usr_alex"), id, {})).toThrow();
    publishContent(db, novak, "quiz", id, "cls_10a");
    expect(submitAttempt(db, actor(db, "usr_alex"), id, {}).total).toBe(1);
  });
});

describe("flashcards", () => {
  it("moves cards through Leitner boxes", () => {
    const alex = actor(db, "usr_alex");
    expect(reviewCard(db, alex, "set_newton_c0", true).box).toBe(2);
    expect(reviewCard(db, alex, "set_newton_c0", true).box).toBe(3);
    expect(reviewCard(db, alex, "set_newton_c0", false).box).toBe(1);
  });

  it("caps flashcard XP per day", () => {
    const alex = actor(db, "usr_alex");
    const cards = db.all<{ id: string }>(`SELECT id FROM flashcards`);
    let xp = 0;
    for (const c of cards) xp += reviewCard(db, alex, c.id, true).xp;
    expect(xp).toBe(FLASHCARD_XP_DAILY_CAP);
  });
});
