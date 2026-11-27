"use server";

import { refresh } from "next/cache";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { submitHomework } from "@/lib/domain/catalog";
import { cancelRegistration, registerForActivity } from "@/lib/domain/credits";
import { claimQuest, levelInfo, logStudySession, streak } from "@/lib/domain/gamification";
import { reviewCard, submitAttempt } from "@/lib/domain/study";
import { invalid } from "@/lib/auth/errors";
import { config } from "@/lib/config/env";
import { putObject } from "@/lib/documents/storage";
import { validateUpload } from "@/lib/documents/validate";
import { attempt } from "./_run";

function snapshot(userId: string) {
  const db = getDb();
  return { level: levelInfo(db, userId), streak: streak(db, userId) };
}

export async function claimQuestAction(questId: string) {
  const actor = await requireActor(["student"]);
  const before = snapshot(actor.id);
  const res = await attempt(() => ({ xp: claimQuest(getDb(), actor, String(questId)), before, after: snapshot(actor.id) }));
  if (res.ok) refresh();
  return res;
}

export async function logStudyAction(minutes: number, activity: string) {
  const actor = await requireActor(["student"]);
  const before = snapshot(actor.id);
  const res = await attempt(() => ({ ...logStudySession(getDb(), actor, Number(minutes), String(activity || "Focused study")), before, after: snapshot(actor.id) }));
  if (res.ok) refresh();
  return res;
}

export async function submitHomeworkAction(assignmentId: string, body: string, fileName: string | null) {
  const actor = await requireActor(["student"]);
  const res = await attempt(() => submitHomework(getDb(), actor, String(assignmentId), { body: String(body ?? ""), fileName: fileName ? String(fileName).slice(0, 120) : null }));
  if (res.ok) refresh();
  return res;
}

/** Homework submission with an optional attachment (validated by content, stored privately). */
export async function submitHomeworkFormAction(formData: FormData) {
  const actor = await requireActor(["student"]);
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const body = String(formData.get("body") ?? "");
  const file = formData.get("file");
  const res = await attempt(async () => {
    let fileName: string | null = null;
    if (file instanceof File && file.size > 0) {
      const data = new Uint8Array(await file.arrayBuffer());
      const v = validateUpload(file.name, data, config.maxUploadBytes);
      if (!v.ok) throw invalid(v.reason);
      await putObject(`${actor.schoolId}/homework/${assignmentId.replace(/[^\w-]/g, "")}/${actor.id}/${v.safeName}`, data);
      fileName = v.safeName;
    }
    return submitHomework(getDb(), actor, assignmentId, { body, fileName });
  });
  if (res.ok) refresh();
  return res;
}

export async function registerActivityAction(activityId: string) {
  const actor = await requireActor(["student"]);
  const res = await attempt(() => registerForActivity(getDb(), actor, String(activityId)));
  if (res.ok) refresh();
  return res;
}

export async function cancelRegistrationAction(activityId: string) {
  const actor = await requireActor(["student"]);
  const res = await attempt(() => cancelRegistration(getDb(), actor, String(activityId)));
  if (res.ok) refresh();
  return res;
}


export async function reviewCardAction(cardId: string, correct: boolean) {
  const actor = await requireActor(["student", "teacher"]);
  return attempt(() => reviewCard(getDb(), actor, String(cardId), correct === true));
}

export async function submitQuizAction(quizId: string, answers: Record<string, string>, durationS: number | null) {
  const actor = await requireActor(["student", "teacher"]);
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(answers ?? {})) if (typeof v === "string") clean[String(k)] = v.slice(0, 500);
  const before = snapshot(actor.id);
  return attempt(() => ({ ...submitAttempt(getDb(), actor, String(quizId), clean, durationS ?? undefined), before, after: snapshot(actor.id) }));
}

/** Called when a learner leaves a quiz/flashcard results view so dashboards update. */
export async function refreshAction() {
  await requireActor();
  refresh();
}
