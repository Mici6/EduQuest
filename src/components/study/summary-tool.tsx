"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Copy, Layers, ListChecks, WandSparkles } from "lucide-react";
import { generateSummary } from "@/lib/ai/browser";
import { OriginBadge } from "@/components/ui/ai-badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import type { Summary } from "@/lib/ai/types";
import { SourcePicker, emptySource, sourceReady, sourceSpec, type DocOption } from "./source-picker";

export function SummaryTool({ docs, initialDocId, disabled }: { docs: DocOption[]; initialDocId: string | null; disabled: boolean }) {
  const toast = useToast();
  const [source, setSource] = useState(() => emptySource(docs, initialDocId));
  const [length, setLength] = useState<"concise" | "detailed">("concise");
  const [format, setFormat] = useState<"notes" | "chapter" | "revision">("notes");
  const [result, setResult] = useState<{ summary: Summary; simulated: boolean; sourceTitle: string } | null>(null);
  const [pending, start] = useTransition();

  const generate = () =>
    start(async () => {
      const res = await generateSummary(sourceSpec(source), { length, format });
      if (!res.ok) return toast({ tone: "error", title: "Couldn't summarise", body: res.error });
      setResult(res.data);
    });

  const asText = (s: Summary) =>
    [s.title, "", s.overview, "", "Key points:", ...s.keyPoints.map((k) => `• ${k}`), "", ...s.definitions.map((d) => `${d.term}: ${d.definition}`), ...s.formulas].join("\n");

  return (
    <div className="grid gap-5 @4xl:grid-cols-[minmax(0,380px)_1fr]">
      <Card className="h-fit">
        <CardHeader title="Source & options" />
        <div className="space-y-4">
          <SourcePicker docs={docs} value={source} onChange={setSource} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Length" htmlFor="sum-len">
              <Select id="sum-len" value={length} onChange={(e) => setLength(e.target.value as "concise" | "detailed")}>
                <option value="concise">Concise</option>
                <option value="detailed">Detailed</option>
              </Select>
            </Field>
            <Field label="Format" htmlFor="sum-fmt">
              <Select id="sum-fmt" value={format} onChange={(e) => setFormat(e.target.value as "notes" | "chapter" | "revision")}>
                <option value="notes">Study notes</option>
                <option value="chapter">Chapter summary</option>
                <option value="revision">Revision sheet</option>
              </Select>
            </Field>
          </div>
          <Button className="w-full" onClick={generate} loading={pending} disabled={disabled || !sourceReady(source)}>
            <WandSparkles /> Generate summary
          </Button>
        </div>
      </Card>

      <div>
        {pending ? (
          <Card aria-busy>
            <Skeleton className="mb-4 h-6 w-1/2" />
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="mb-2.5 h-4 w-full" />
            ))}
          </Card>
        ) : result ? (
          <Card className="animate-fade-up">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <OriginBadge origin={result.simulated ? "simulated" : "ai"} />
                <h2 className="mt-2 font-display text-xl font-semibold">{result.summary.title}</h2>
                <p className="text-xs text-fg-3">Source: {result.sourceTitle}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(asText(result.summary));
                  toast({ tone: "success", title: "Copied to clipboard" });
                }}
              >
                <Copy /> Copy
              </Button>
            </div>
            <p className="text-sm leading-relaxed text-fg-2">{result.summary.overview}</p>
            {result.summary.keyPoints.length ? (
              <section className="mt-5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-sun-300">Key points</h3>
                <ul className="space-y-2 text-sm">
                  {result.summary.keyPoints.map((k, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sun-300" aria-hidden />
                      {k}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {result.summary.keyConcepts.length ? (
              <section className="mt-5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-iris-300">Key concepts</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {result.summary.keyConcepts.map((c, i) => (
                    <div key={i} className="rounded-2xl border border-line bg-ink-900/60 p-3">
                      <p className="text-sm font-semibold">{c.term}</p>
                      <p className="mt-1 text-xs text-fg-2">{c.explanation}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {result.summary.definitions.length ? (
              <section className="mt-5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-mint">Definitions</h3>
                <dl className="space-y-2 text-sm">
                  {result.summary.definitions.map((d, i) => (
                    <div key={i}>
                      <dt className="font-semibold">{d.term}</dt>
                      <dd className="text-fg-2">{d.definition}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
            {result.summary.formulas.length ? (
              <section className="mt-5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber">Formula sheet</h3>
                <ul className="space-y-1.5">
                  {result.summary.formulas.map((f, i) => (
                    <li key={i} className="rounded-xl bg-ink-950/60 px-3 py-2 font-mono text-xs">
                      {f}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {result.summary.importantDates.length ? (
              <section className="mt-5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-sky">Important dates</h3>
                <ul className="space-y-1.5 text-sm text-fg-2">
                  {result.summary.importantDates.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {source.mode === "document" ? (
              <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
                <Link href={`/app/flashcards?generate=1&doc=${source.documentId}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink-700 px-4 text-xs font-semibold hover:bg-ink-750">
                  <Layers className="size-3.5" /> Make flashcards
                </Link>
                <Link href={`/app/study/quiz?doc=${source.documentId}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink-700 px-4 text-xs font-semibold hover:bg-ink-750">
                  <ListChecks className="size-3.5" /> Practice quiz
                </Link>
              </div>
            ) : null}
          </Card>
        ) : (
          <EmptyState icon={<WandSparkles />} title="Your summary will appear here" className="h-full min-h-72">
            Choose a lesson, a topic or paste notes, then pick a length and format.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
