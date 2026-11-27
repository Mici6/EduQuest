"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HandCoins, Lock, WandSparkles } from "lucide-react";
import { requestAiCourseAction } from "@/actions/ai-courses";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

const IDEAS = ["First aid", "Debate", "Public speaking", "Personal finance", "Photography", "Climate science"];

export function AiCourseRequest({
  reviewers,
  grant,
  currency,
  minJustification,
}: {
  reviewers: { id: string; display_name: string }[];
  grant: { eligible: boolean; reasons: string[]; maxAmount: number };
  currency: string;
  minJustification: number;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [topic, setTopic] = useState("");
  const [reviewerId, setReviewerId] = useState(reviewers[0]?.id ?? "");
  const [wantsGrant, setWantsGrant] = useState(false);
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");

  const submit = () =>
    start(async () => {
      const res = await requestAiCourseAction({ topic, reviewerId, grantRequested: wantsGrant && grant.eligible ? Number(amount) : 0, grantPurpose: wantsGrant && grant.eligible ? purpose : "" });
      if (!res.ok) return toast({ tone: "error", title: "Couldn't create the course", body: res.error });
      toast({ tone: "success", title: "Course created", body: "Your teacher will review it before you start." });
      router.push(`/app/courses/ai/${res.data}`);
    });

  return (
    <Card className="border-iris-400/30">
      <CardHeader title="Create a course with AI" subtitle="Pick any topic. AI writes the lessons and quiz, and a teacher reviews them before you start." icon={<WandSparkles className="size-5 text-iris-200" />} />
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Topic" htmlFor="aic-topic">
          <Input id="aic-topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={80} placeholder="e.g. First aid" required />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {IDEAS.map((i) => (
            <button key={i} type="button" onClick={() => setTopic(i)} className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-fg-2 hover:border-line-strong hover:text-fg">
              {i}
            </button>
          ))}
        </div>
        <Field label="Reviewing teacher" htmlFor="aic-reviewer" hint="They approve the course and, once you pass, accredit it with a letter of recommendation.">
          <Select id="aic-reviewer" value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} required>
            {reviewers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.display_name}
              </option>
            ))}
          </Select>
        </Field>
        {grant.eligible ? (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={wantsGrant} onChange={(e) => setWantsGrant(e.target.checked)} className="mt-1 accent-[var(--color-sun-300)]" />
            <span>
              <span className="font-semibold">Ask for a school grant</span> (e.g. a certified exam, materials or a kit). Up to {grant.maxAmount} {currency}. Your teacher recommends it, the school
              administration decides, and the money is only released once your course is accredited.
            </span>
          </label>
        ) : (
          <div className="rounded-2xl border border-line bg-ink-900/60 p-3.5 text-sm">
            <p className="inline-flex items-center gap-2 font-semibold">
              <Lock className="size-4 text-fg-3" aria-hidden /> School grants are locked
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-fg-2">
              {grant.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {wantsGrant && grant.eligible ? (
          <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
            <Field label={`Amount (${currency})`} htmlFor="aic-amount" hint={`Max ${grant.maxAmount}`}>
              <Input id="aic-amount" type="number" inputMode="numeric" min={1} max={grant.maxAmount} value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </Field>
            <Field
              label="Justification"
              htmlFor="aic-purpose"
              hint={`${purpose.trim().length} / ${minJustification} characters minimum. Say what it pays for, what it costs, and why you can't cover it yourself.`}
            >
              <Textarea
                id="aic-purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                minLength={minJustification}
                maxLength={1000}
                rows={5}
                placeholder="The Red Cross first-aid certification exam costs 150 RON. It turns this course into a recognised certificate I can use for…"
                required
              />
            </Field>
          </div>
        ) : null}
        <Button type="submit" variant="iris" loading={pending} disabled={!topic.trim() || !reviewerId} className="w-full sm:w-auto">
          {wantsGrant ? <HandCoins /> : <WandSparkles />} {pending ? "Writing your course…" : "Create course"}
        </Button>
      </form>
    </Card>
  );
}
