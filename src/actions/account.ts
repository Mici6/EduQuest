"use server";

import { refresh } from "next/cache";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { frameUnlocked, levelInfo } from "@/lib/domain/gamification";
import { markAllRead, markRead, saveUserSettings, type UserSettings } from "@/lib/domain/notifications";
import { attempt } from "./_run";

export async function markReadAction(id: string, read = true) {
  const actor = await requireActor();
  const res = await attempt(() => markRead(getDb(), actor, String(id), read === true));
  if (res.ok) refresh();
  return res;
}

export async function markAllReadAction() {
  const actor = await requireActor();
  const res = await attempt(() => markAllRead(getDb(), actor));
  if (res.ok) refresh();
  return res;
}

export async function saveSettingsAction(patch: Partial<UserSettings>) {
  const actor = await requireActor();
  const safe: Partial<UserSettings> = {};
  if (patch.notifications && typeof patch.notifications === "object") {
    safe.notifications = Object.fromEntries(Object.entries(patch.notifications).filter(([, v]) => typeof v === "boolean"));
  }
  if (typeof patch.showOnLeaderboard === "boolean") safe.showOnLeaderboard = patch.showOnLeaderboard;
  if (typeof patch.reduceMotion === "boolean") safe.reduceMotion = patch.reduceMotion;
  if (typeof patch.dailyStudyGoalMinutes === "number") safe.dailyStudyGoalMinutes = patch.dailyStudyGoalMinutes;
  if (typeof patch.profileFrame === "string") {
    // Frames are cosmetic level unlocks; the server checks the level, not the client.
    if (!frameUnlocked(patch.profileFrame, levelInfo(getDb(), actor.id).level)) {
      return { ok: false as const, error: "That frame unlocks at a higher level." };
    }
    safe.profileFrame = patch.profileFrame;
  }
  const res = await attempt(() => saveUserSettings(getDb(), actor, safe));
  if (res.ok) refresh();
  return res;
}
