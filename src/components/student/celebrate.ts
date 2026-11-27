"use client";

type Snapshot = { level: { level: number; title: string }; streak: { current: number } };

/** Build the follow-up toasts for a reward event (level-ups, streaks). */
export function celebrations(before: Snapshot, after: Snapshot): { title: string; body?: string }[] {
  const out: { title: string; body?: string }[] = [];
  if (after.level.level > before.level.level) out.push({ title: `Level ${after.level.level} reached!`, body: `New title: ${after.level.title}.` });
  if (after.streak.current > before.streak.current) out.push({ title: `${after.streak.current}-day streak 🔥`, body: "Learning a little every day adds up." });
  return out;
}
