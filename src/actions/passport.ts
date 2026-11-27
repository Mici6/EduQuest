"use server";

import { refresh } from "next/cache";
import { requireActor } from "@/lib/auth/current";
import { aiFor, withAiErrors } from "@/lib/ai/guard";
import { getDb } from "@/lib/db";
import { completeLesson, submitCourseQuiz, unlockCourse } from "@/lib/domain/courses";
import { revokeCredential } from "@/lib/domain/credentials";
import { addProject, deleteProject, draftRecommendation, issuePassport, issueRecommendation, verifyProject } from "@/lib/domain/passport";
import { attempt } from "./_run";

async function run<T>(roles: ("student" | "teacher" | "admin")[], fn: (actor: Awaited<ReturnType<typeof requireActor>>) => T | Promise<T>) {
  const actor = await requireActor(roles);
  const res = await attempt(() => fn(actor));
  if (res.ok) refresh();
  return res;
}

// ── Mini-courses ─────────────────────────────────────────────────────────────
export const unlockCourseAction = async (courseId: string) => run(["student"], (a) => unlockCourse(getDb(), a, String(courseId)));
export const completeLessonAction = async (courseId: string, index: number) => run(["student"], (a) => completeLesson(getDb(), a, String(courseId), Number(index)));
export const submitCourseQuizAction = async (courseId: string, answers: string[]) =>
  run(["student"], (a) => submitCourseQuiz(getDb(), a, String(courseId), Array.isArray(answers) ? answers.map(String) : []));

// ── Skills Passport ────────────────────────────────────────────────────────────
export const addProjectAction = async (input: { title: string; description: string; link: string }) =>
  run(["student"], (a) => addProject(getDb(), a, { title: String(input.title ?? ""), description: String(input.description ?? ""), link: String(input.link ?? "") }));
export const deleteProjectAction = async (id: string) => run(["student"], (a) => deleteProject(getDb(), a, String(id)));
export const verifyProjectAction = async (id: string, verified: boolean) => run(["teacher"], (a) => verifyProject(getDb(), a, String(id), verified === true));
export const issuePassportAction = async () => run(["student"], (a) => issuePassport(getDb(), a));
export const revokeCredentialAction = async (id: string) => run(["student", "teacher", "admin"], (a) => revokeCredential(getDb(), a, String(id)));

// ── Recommendation letters ──────────────────────────────────────────────────────
export async function draftRecommendationAction(studentId: string, purpose: string, recipient: string) {
  const actor = await requireActor(["teacher"]);
  return attempt(() => {
    const db = getDb();
    const ai = aiFor(db, actor);
    return withAiErrors(() => draftRecommendation(db, actor, ai, String(studentId), String(purpose), String(recipient ?? "") || null));
  });
}

export const issueRecommendationAction = async (studentId: string, input: { purpose: string; recipient: string; body: string }) =>
  run(["teacher"], (a) =>
    issueRecommendation(getDb(), a, String(studentId), { purpose: String(input.purpose), recipient: String(input.recipient ?? "") || null, body: String(input.body ?? "") }),
  );
