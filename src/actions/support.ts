"use server";

import { refresh } from "next/cache";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { addPlanNote, createPlan, reviewIndicator, setPlanStatus, triggerDetection } from "@/lib/domain/support";
import { attempt } from "./_run";

export async function reviewIndicatorAction(indicatorId: string, decision: "confirmed" | "dismissed", rationale: string) {
  const actor = await requireActor(["support"]);
  const res = await attempt(() => reviewIndicator(getDb(), actor, String(indicatorId), decision === "confirmed" ? "confirmed" : "dismissed", String(rationale ?? "")));
  if (res.ok) refresh();
  return res;
}

export async function createPlanAction(input: { studentId: string; indicatorId?: string | null; goals: string; actions: string; reviewOn: string }) {
  const actor = await requireActor(["support"]);
  const res = await attempt(() =>
    createPlan(getDb(), actor, {
      studentId: String(input.studentId),
      indicatorId: input.indicatorId ? String(input.indicatorId) : null,
      goals: String(input.goals ?? ""),
      actions: String(input.actions ?? ""),
      reviewOn: String(input.reviewOn ?? ""),
    }),
  );
  if (res.ok) refresh();
  return res;
}

export async function addPlanNoteAction(planId: string, kind: "note" | "follow_up" | "progress_review", body: string) {
  const actor = await requireActor(["support"]);
  const res = await attempt(() => addPlanNote(getDb(), actor, String(planId), kind, String(body ?? "")));
  if (res.ok) refresh();
  return res;
}

export async function setPlanStatusAction(planId: string, status: "active" | "monitoring" | "closed") {
  const actor = await requireActor(["support"]);
  const res = await attempt(() => setPlanStatus(getDb(), actor, String(planId), status));
  if (res.ok) refresh();
  return res;
}

export async function runDetectionAction() {
  const actor = await requireActor(["support"]);
  const res = await attempt(() => triggerDetection(getDb(), actor));
  if (res.ok) refresh();
  return res;
}
