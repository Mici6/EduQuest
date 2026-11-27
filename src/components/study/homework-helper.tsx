"use client";

import { useState, useTransition } from "react";
import { BookOpen, ChevronDown, Lightbulb, ShieldQuestion, WandSparkles } from "lucide-react";
import { homeworkHelp } from "@/lib/ai/browser";
import { OriginBadge } from "@/components/ui/ai-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/form";
import { EmptyState, Notice, Skeleton } from "@/components/ui/states";
import { PillTabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import type { HomeworkHelp } from "@/lib/ai/types";
import { UploadPanel } from "@/components/library/upload-panel";

type Result = { help: HomeworkHelp; sources: { id: string; title: string; excerpt: string }[]; simulated: boolean };

export function HomeworkHelper({ disabled, subjects }: { disabled: boolean; subjects: { id: string; name: string }[] }) {
  const toast = useToast();
  const [question, setQuestion] = useState("");
  const [level, setLevel] = useState<"simpler" | "standard" | "advanced">("standard");
  const [result, setResult] = useState<Result | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [openStep, setOpenStep] = useState(0);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      const res = await homeworkHelp(question, level, docId);
      if (!res.ok) return toast({ tone: "error", title: "Couldn't help with that", body: res.error });
      setResult(res.data);
      setOpenStep(0);
    });

  return (
    <div className="grid gap-5 @4xl:grid-cols-[minmax(0,420px)_1fr]">
      <div className="space-y-5">
        <Card>
          <CardHeader title="Your question" subtitle="Paste or type it. A guided solution helps you learn the method." />
          <div className="space-y-4">
            <Field label="Question" htmlFor="hh-q">
              <Textarea id="hh-q" value={question} onChange={(e) => setQuestion(e.target.value)} rows={6} placeholder="e.g. Solve 3(x − 2) = 2x + 5 and check your answer." maxLength={8000} />
            </Field>
            <PillTabs
              label="Explanation level"
              size="sm"
              value={level}
              onChange={setLevel}
              items={[
                { value: "simpler", label: "Simpler" },
                { value: "standard", label: "Standard" },
                { value: "advanced", label: "Advanced" },
              ]}
            />
            <Button className="w-full" onClick={run} loading={pending} disabled={disabled || question.trim().length < 8}>
              <WandSparkles /> Guide me through it
            </Button>
          </div>
        </Card>
        <Card>
          <CardHeader title="Upload a photo or PDF" subtitle="We extract the text so you can use it as your question" />
          <UploadPanel
            compact
            role="student"
            subjects={subjects}
            classes={[]}
            onIndexed={(id, text) => {
              setDocId(id);
              if (text) setQuestion(text.slice(0, 4000));
            }}
          />
        </Card>
      </div>

      <div>
        {pending ? (
          <Card aria-busy>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="mb-3 h-12 w-full" />
            ))}
          </Card>
        ) : result ? (
          <Card className="animate-fade-up">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <OriginBadge origin={result.simulated ? "simulated" : "ai"} />
              {result.sources.length ? (
                <Badge tone="mint" icon={<BookOpen />}>
                  Uses your lesson materials
                </Badge>
              ) : null}
            </div>
            <h2 className="font-display text-lg font-semibold">What the question is asking</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-fg-2">{result.help.understanding}</p>
            {result.help.concepts.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {result.help.concepts.map((c) => (
                  <Badge key={c} tone="iris">
                    {c}
                  </Badge>
                ))}
              </div>
            ) : null}
            <ol className="mt-5 space-y-2">
              {result.help.steps.map((s, i) => (
                <li key={i} className="overflow-hidden rounded-2xl border border-line bg-ink-900/60">
                  <button type="button" onClick={() => setOpenStep(openStep === i ? -1 : i)} aria-expanded={openStep === i} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-sun-200 text-xs font-bold text-ink-950">{i + 1}</span>
                    <span className="flex-1 text-sm font-semibold">{s.title}</span>
                    <ChevronDown className={openStep === i ? "size-4 rotate-180 transition-transform" : "size-4 transition-transform"} aria-hidden />
                  </button>
                  {openStep === i ? (
                    <div className="space-y-2 border-t border-line px-4 py-3 text-sm">
                      <p className="leading-relaxed text-fg-2">{s.guidance}</p>
                      <p className="inline-flex items-start gap-1.5 text-xs text-sky">
                        <ShieldQuestion className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Check: {s.check}
                      </p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
            <Notice tone="warn" icon={<Lightbulb />} title="Final hint" className="mt-5">
              {result.help.finalHint}
            </Notice>
            <p className="mt-3 text-xs text-fg-3">Self-check: {result.help.selfCheck}</p>
          </Card>
        ) : (
          <EmptyState icon={<Lightbulb />} title="Step-by-step guidance appears here" className="h-full min-h-72">
            EduQuest explains the method and checks your understanding rather than handing over the final answer.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
