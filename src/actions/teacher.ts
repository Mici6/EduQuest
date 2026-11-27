"use server";

import { refresh } from "next/cache";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { addGrade, createAssignment, postAnnouncement, recordAttendance, returnSubmission } from "@/lib/domain/catalog";
import { createActivity, verifyParticipation } from "@/lib/domain/credits";
import { attempt } from "./_run";

export async function addGradeAction(input: { studentId: string; classId: string; subjectId: string; value: number; kind: string; title: string; gradedOn: string }) {
  const actor = await requireActor(["teacher"]);
  const res = await attempt(() =>
    addGrade(getDb(), actor, {
      studentId: String(input.studentId),
      classId: String(input.classId),
      subjectId: String(input.subjectId),
      value: Number(input.value),
      kind: String(input.kind),
      title: String(input.title ?? ""),
      gradedOn: String(input.gradedOn),
    }),
  );
  if (res.ok) refresh();
  return res;
}

export async function recordAttendanceAction(input: { classId: string; subjectId: string; date: string; entries: { studentId: string; status: "present" | "absent" | "late" | "excused" }[] }) {
  const actor = await requireActor(["teacher"]);
  const res = await attempt(() =>
    recordAttendance(getDb(), actor, {
      classId: String(input.classId),
      subjectId: String(input.subjectId),
      date: String(input.date),
      entries: (input.entries ?? []).map((e) => ({ studentId: String(e.studentId), status: e.status })),
    }),
  );
  if (res.ok) refresh();
  return res;
}

export async function createAssignmentAction(input: { classId: string; subjectId: string; title: string; description: string; dueAt: string; origin?: "manual" | "ai_reviewed" }) {
  const actor = await requireActor(["teacher"]);
  const res = await attempt(() =>
    createAssignment(getDb(), actor, {
      classId: String(input.classId),
      subjectId: String(input.subjectId),
      title: String(input.title ?? ""),
      description: String(input.description ?? ""),
      dueAt: String(input.dueAt),
      origin: input.origin === "ai_reviewed" ? "ai_reviewed" : "manual",
    }),
  );
  if (res.ok) refresh();
  return res;
}

export async function returnSubmissionAction(submissionId: string, feedback: string) {
  const actor = await requireActor(["teacher"]);
  const res = await attempt(() => returnSubmission(getDb(), actor, String(submissionId), String(feedback ?? "")));
  if (res.ok) refresh();
  return res;
}

export async function postAnnouncementAction(input: { classId: string | null; title: string; body: string; pinned?: boolean }) {
  const actor = await requireActor(["teacher", "admin"]);
  const res = await attempt(() =>
    postAnnouncement(getDb(), actor, { classId: input.classId ? String(input.classId) : null, title: String(input.title ?? ""), body: String(input.body ?? ""), pinned: input.pinned === true }),
  );
  if (res.ok) refresh();
  return res;
}

export async function verifyParticipationAction(registrationId: string, attended: boolean) {
  const actor = await requireActor(["teacher", "admin"]);
  const res = await attempt(() => verifyParticipation(getDb(), actor, String(registrationId), attended === true));
  if (res.ok) refresh();
  return res;
}

export async function createActivityAction(input: { title: string; description: string; category: string; location: string; startsAt: string; durationMinutes: number; capacity: number; credits: number }) {
  const actor = await requireActor(["teacher", "admin"]);
  const res = await attempt(() =>
    createActivity(getDb(), actor, {
      title: String(input.title ?? ""),
      description: String(input.description ?? ""),
      category: String(input.category ?? "School"),
      location: String(input.location ?? ""),
      startsAt: String(input.startsAt),
      durationMinutes: Math.round(Number(input.durationMinutes)),
      capacity: Math.round(Number(input.capacity)),
      credits: Math.round(Number(input.credits)),
    }),
  );
  if (res.ok) refresh();
  return res;
}
