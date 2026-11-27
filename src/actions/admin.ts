"use server";

import { refresh } from "next/cache";
import { requireActor } from "@/lib/auth/current";
import type { Role } from "@/lib/auth/types";
import { getDb } from "@/lib/db";
import { assignTeacher, createClass, createPerson, createSubject, setUserActive, updateSchoolSettings, type SchoolSettings } from "@/lib/domain/admin";
import { attempt } from "./_run";

export async function updateSchoolSettingsAction(patch: Partial<SchoolSettings>) {
  const actor = await requireActor(["admin"]);
  const safe: Partial<SchoolSettings> = {};
  for (const k of ["aiEnabledForStudents", "questsEnabled", "leaderboardEnabled", "studentUploadsEnabled"] as const) {
    if (typeof patch[k] === "boolean") safe[k] = patch[k];
  }
  if (typeof patch.aiDailyLimit === "number") safe.aiDailyLimit = patch.aiDailyLimit;
  if (typeof patch.supportRetentionMonths === "number") safe.supportRetentionMonths = patch.supportRetentionMonths;
  if (typeof patch.grantBudget === "number") safe.grantBudget = patch.grantBudget;
  if (typeof patch.grantCurrency === "string") safe.grantCurrency = patch.grantCurrency.toUpperCase();
  const res = await attempt(() => updateSchoolSettings(getDb(), actor, safe));
  if (res.ok) refresh();
  return res;
}

export async function createPersonAction(input: { name: string; email: string; role: Role; classId?: string | null }) {
  const actor = await requireActor(["admin"]);
  const res = await attempt(() => createPerson(getDb(), actor, { name: String(input.name ?? ""), email: String(input.email ?? ""), role: input.role, classId: input.classId ? String(input.classId) : null }));
  if (res.ok) refresh();
  return res;
}

export async function setUserActiveAction(userId: string, active: boolean) {
  const actor = await requireActor(["admin"]);
  const res = await attempt(() => setUserActive(getDb(), actor, String(userId), active === true));
  if (res.ok) refresh();
  return res;
}

export async function createClassAction(input: { name: string; gradeLevel: number; homeroomTeacherId?: string | null }) {
  const actor = await requireActor(["admin"]);
  const res = await attempt(() => createClass(getDb(), actor, { name: String(input.name ?? ""), gradeLevel: Math.round(Number(input.gradeLevel)), homeroomTeacherId: input.homeroomTeacherId ? String(input.homeroomTeacherId) : null }));
  if (res.ok) refresh();
  return res;
}

export async function createSubjectAction(input: { name: string; short: string; color: string }) {
  const actor = await requireActor(["admin"]);
  const res = await attempt(() => createSubject(getDb(), actor, { name: String(input.name ?? ""), short: String(input.short ?? ""), color: String(input.color ?? "") }));
  if (res.ok) refresh();
  return res;
}

export async function assignTeacherAction(input: { teacherId: string; classId: string; subjectId: string }) {
  const actor = await requireActor(["admin"]);
  const res = await attempt(() => assignTeacher(getDb(), actor, { teacherId: String(input.teacherId), classId: String(input.classId), subjectId: String(input.subjectId) }));
  if (res.ok) refresh();
  return res;
}

