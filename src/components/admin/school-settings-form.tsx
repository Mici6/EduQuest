"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { updateSchoolSettingsAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import type { SchoolSettings } from "@/lib/domain/admin";

export function SchoolSettingsForm({ initial }: { initial: SchoolSettings }) {
  const toast = useToast();
  const [s, setS] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <div>
      <div className="divide-y divide-line/60">
        <Switch id="ss-ai" label="AI study tools for students" description="Teachers keep access to the AI Studio either way." checked={s.aiEnabledForStudents} onChange={(v) => setS({ ...s, aiEnabledForStudents: v })} />
        <Switch id="ss-q" label="Daily quests & weekly challenges" checked={s.questsEnabled} onChange={(v) => setS({ ...s, questsEnabled: v })} />
        <Switch id="ss-lb" label="Opt-in XP leaderboard" description="Students choose individually whether to appear. Never shows grades." checked={s.leaderboardEnabled} onChange={(v) => setS({ ...s, leaderboardEnabled: v })} />
        <Switch id="ss-up" label="Student document uploads" description="Uploads are private to each student." checked={s.studentUploadsEnabled} onChange={(v) => setS({ ...s, studentUploadsEnabled: v })} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="AI requests per user per day" htmlFor="ss-limit" hint="0 disables AI requests entirely.">
          <Input id="ss-limit" type="number" min={0} max={500} value={s.aiDailyLimit} onChange={(e) => setS({ ...s, aiDailyLimit: Number(e.target.value) })} />
        </Field>
        <Field label="Support record retention (months)" htmlFor="ss-ret" hint="Applied to new support plans. Align with your data-protection policy.">
          <Input id="ss-ret" type="number" min={1} max={36} value={s.supportRetentionMonths} onChange={(e) => setS({ ...s, supportRetentionMonths: Number(e.target.value) })} />
        </Field>
      </div>
      <Button
        className="mt-5"
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await updateSchoolSettingsAction(s);
            toast(res.ok ? { tone: "success", title: "School settings saved", body: "The change was recorded in the audit log." } : { tone: "error", title: "Couldn't save", body: res.error });
          })
        }
      >
        <Save /> Save settings
      </Button>
    </div>
  );
}
