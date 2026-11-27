"use server";

import { refresh } from "next/cache";
import { requireActor } from "@/lib/auth/current";
import { aiFor, withAiErrors } from "@/lib/ai/guard";
import { getDb } from "@/lib/db";
import { accreditAiCourse, completeAiLesson, decideGrant, draftCourseLetter, requestAiCourse, reviewAiCourse, submitAiCourseQuiz } from "@/lib/domain/ai-courses";
import { attempt } from "./_run";

async function run<T>(roles: ("student" | "teacher" | "admin")[], fn: (actor: Awaited<ReturnType<typeof requireActor>>) => T | Promise<T>) {
  const actor = await requireActor(roles);
  const res = await attempt(() => fn(actor));
  if (res.ok) refresh();
  return res;
}

export const requestAiCourseAction = async (input: { topic: string; reviewerId: string; grantRequested: number; grantPurpose: string }) =>
  run(["student"], (a) => {
    const db = getDb();
    const ai = aiFor(db, a);
    return withAiErrors(() =>
      requestAiCourse(db, a, ai, { topic: String(input.topic ?? ""), reviewerId: String(input.reviewerId ?? ""), grantRequested: Number(input.grantRequested) || 0, grantPurpose: String(input.grantPurpose ?? "") }),
    );
  });

export const completeAiLessonAction = async (id: string, index: number) => run(["student"], (a) => completeAiLesson(getDb(), a, String(id), Number(index)));
export const submitAiCourseQuizAction = async (id: string, answers: string[]) =>
  run(["student"], (a) => submitAiCourseQuiz(getDb(), a, String(id), Array.isArray(answers) ? answers.map(String) : []));

export const reviewAiCourseAction = async (id: string, input: { approve: boolean; note: string; grant: number }) =>
  run(["teacher"], (a) => reviewAiCourse(getDb(), a, String(id), { approve: input.approve === true, note: String(input.note ?? ""), grant: Number(input.grant) || 0 }));

export async function draftCourseLetterAction(id: string) {
  const actor = await requireActor(["teacher"]);
  return attempt(() => {
    const db = getDb();
    const ai = aiFor(db, actor);
    return withAiErrors(() => draftCourseLetter(db, actor, ai, String(id)));
  });
}

export const accreditAiCourseAction = async (id: string, body: string) => run(["teacher"], (a) => accreditAiCourse(getDb(), a, String(id), String(body ?? "")));

export const decideGrantAction = async (id: string, input: { approve: boolean; amount: number; note: string }) =>
  run(["admin"], (a) => decideGrant(getDb(), a, String(id), { approve: input.approve === true, amount: Number(input.amount) || 0, note: String(input.note ?? "") }));
