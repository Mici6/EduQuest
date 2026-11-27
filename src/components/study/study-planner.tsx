"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, WandSparkles } from "lucide-react";
import { studyPlan } from "@/lib/ai/browser";
import { OriginBadge } from "@/components/ui/ai-badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { EmptyState, Notice, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import type { StudyPlan } from "@/lib/ai/types";

export function StudyPlanner({ disabled }: { disabled: boolean }) {
  const toast = useToast();
  const [days, setDays] = useState(5);
  const [minutes, setMinutes] = useState(30);
  const [result, setResult] = useState<{ plan: StudyPlan; simulated: boolean } | null>(null);
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      const res = await studyPlan(days, minutes);
      if (!res.ok) return toast({ tone: "error", title: "Couldn't build a plan", body: res.error });
      setResult(res.data);
    });
  return (
    <div className="grid gap-5 @4xl:grid-cols-[minmax(0,340px)_1fr]">
      <Card className="h-fit">
        <CardHeader title="Plan settings" subtitle="Built from your recent grades, upcoming assessments and class materials" />
        <div className="space-y-4">
          <Field label="Days" htmlFor="pl-days">
            <Select id="pl-days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[3, 5, 7].map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Time per day" htmlFor="pl-min" hint="Short, regular sessions work better than long ones.">
            <Select id="pl-min" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {[15, 20, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </Select>
          </Field>
          <Button className="w-full" onClick={run} loading={pending} disabled={disabled}>
            <WandSparkles /> Create my plan
          </Button>
        </div>
      </Card>
      <div>
        {pending ? (
          <Card aria-busy>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="mb-3 h-20 w-full" />
            ))}
          </Card>
        ) : result ? (
          <div className="space-y-4 animate-fade-up">
            <div className="flex flex-wrap items-center gap-2">
              <OriginBadge origin={result.simulated ? "simulated" : "ai"} />
              <p className="text-sm text-fg-2">{result.plan.intro}</p>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2 @5xl:grid-cols-3">
              {result.plan.days.map((d) => (
                <li key={d.day} className="surface rounded-[22px] p-4">
                  <p className="text-xs font-semibold text-sun-300">{d.day}</p>
                  <p className="mt-1 font-display text-base font-semibold">{d.focus}</p>
                  <ul className="mt-3 space-y-2">
                    {d.tasks.map((t, i) => (
                      <li key={i} className="rounded-2xl bg-ink-900/70 p-3">
                        <p className="flex items-start justify-between gap-2 text-sm font-medium">
                          {t.activity}
                          <span className="shrink-0 text-xs tabular-nums text-fg-3">{t.minutes} min</span>
                        </p>
                        <p className="mt-1 text-xs text-fg-3">{t.why}</p>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
            <Notice tone="info">{result.plan.note}</Notice>
          </div>
        ) : (
          <EmptyState icon={<CalendarCheck />} title="Your personalised plan appears here" className="h-full min-h-72">
            Suggestions are based on recent work and upcoming tests — they're never a judgement of your abilities.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
