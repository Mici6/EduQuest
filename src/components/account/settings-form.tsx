"use client";

import { useState, useTransition } from "react";
import { saveSettingsAction } from "@/actions/account";
import { Field, Select } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

type Cat = { id: string; label: string; description: string };

export function NotificationPrefs({ categories, prefs }: { categories: Cat[]; prefs: Record<string, boolean | undefined> }) {
  const toast = useToast();
  const [state, setState] = useState(() => Object.fromEntries(categories.map((c) => [c.id, prefs[c.id] !== false])));
  const [, start] = useTransition();
  const set = (id: string, v: boolean) => {
    setState((s) => ({ ...s, [id]: v }));
    start(async () => {
      const res = await saveSettingsAction({ notifications: { [id]: v } });
      if (!res.ok) toast({ tone: "error", title: "Couldn't save", body: res.error });
    });
  };
  return (
    <div className="divide-y divide-line/60">
      {categories.map((c) => (
        <Switch key={c.id} id={`n-${c.id}`} label={c.label} description={c.description} checked={c.id === "system" ? true : !!state[c.id]} disabled={c.id === "system"} onChange={(v) => set(c.id, v)} />
      ))}
    </div>
  );
}

export function PrivacyPrefs({ showOnLeaderboard, goal, reduceMotion, isStudent }: { showOnLeaderboard: boolean; goal: number; reduceMotion: boolean; isStudent: boolean }) {
  const toast = useToast();
  const [lb, setLb] = useState(showOnLeaderboard);
  const [g, setG] = useState(goal);
  const [rm, setRm] = useState(reduceMotion);
  const [, start] = useTransition();
  const save = (patch: Parameters<typeof saveSettingsAction>[0]) =>
    start(async () => {
      const res = await saveSettingsAction(patch);
      toast(res.ok ? { tone: "success", title: "Saved" } : { tone: "error", title: "Couldn't save", body: res.error });
    });
  return (
    <div className="divide-y divide-line/60">
      {isStudent ? (
        <>
          <Switch
            id="lb"
            label="Show me on the school leaderboard"
            description="Only your first name, last initial and XP are shown. Off by default."
            checked={lb}
            onChange={(v) => {
              setLb(v);
              save({ showOnLeaderboard: v });
            }}
          />
          <div className="py-3">
            <Field label="Daily focused-study goal" htmlFor="goal" hint="A gentle target shown on your dashboard. Study-time XP is capped daily regardless.">
              <Select
                id="goal"
                value={g}
                onChange={(e) => {
                  setG(Number(e.target.value));
                  save({ dailyStudyGoalMinutes: Number(e.target.value) });
                }}
                className="max-w-56"
              >
                {[15, 20, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </>
      ) : null}
      <Switch
        id="rm"
        label="Reduce motion"
        description="EduQuest also follows your device's reduced-motion setting automatically."
        checked={rm}
        onChange={(v) => {
          setRm(v);
          save({ reduceMotion: v });
        }}
      />
    </div>
  );
}
