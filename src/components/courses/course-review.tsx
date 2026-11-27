"use client";

import { useState, useTransition } from "react";
import { Check, ExternalLink, FileSignature, PenLine, Undo2, WandSparkles } from "lucide-react";
import { accreditAiCourseAction, draftCourseLetterAction, reviewAiCourseAction } from "@/actions/ai-courses";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

/**
 * Approve the AI draft or send it back. If the student asked for a grant, the
 * teacher may recommend an amount (default 0 = not recommended); an
 * administrator makes the final decision.
 */
export function CourseReviewPanel({ id, grantRequested, grantMax, currency }: { id: string; grantRequested: number; grantMax: number; currency: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [grant, setGrant] = useState("0");
  const cap = Math.min(grantRequested, grantMax);

  const review = (approve: boolean) =>
    start(async () => {
      const res = await reviewAiCourseAction(id, { approve, note, grant: Number(grant) || 0 });
      if (!res.ok) return toast({ tone: "error", title: "Couldn't save the review", body: res.error });
      const recommended = approve && Number(grant) > 0;
      toast({
        tone: "success",
        title: approve ? "Course approved" : "Course sent back",
        body: approve ? (recommended ? "The grant recommendation goes to the administration for a final decision." : "The student can start now.") : "The student sees your note.",
      });
    });

  return (
    <Card>
      <CardHeader title="Your review" subtitle="Read the lessons and check the quiz answers before approving." />
      <div className="space-y-4">
        {grantRequested ? (
          <Field
            label={`Recommend a grant (${currency})`}
            htmlFor="rev-grant"
            hint={`Requested ${grantRequested} ${currency}; you can recommend up to ${cap}. Leave 0 to decline. Only recommend it if the justification is specific and the cost is real: the administration makes the final decision.`}
          >
            <Input id="rev-grant" type="number" inputMode="numeric" min={0} max={cap} value={grant} onChange={(e) => setGrant(e.target.value)} />
          </Field>
        ) : null}
        <Field label="Note to the student" htmlFor="rev-note" hint="Required when sending the course back.">
          <Textarea id="rev-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} placeholder="Lesson 2 needs the updated CPR guidance…" />
        </Field>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => review(true)} loading={pending}>
            <Check /> Approve
          </Button>
          <Button variant="secondary" onClick={() => review(false)} loading={pending} disabled={!note.trim()}>
            <Undo2 /> Send back
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Draft the accreditation letter with AI, edit it, sign it. */
export function CourseLetterComposer({ id, studentName, teacherName, aiLabel }: { id: string; studentName: string; teacherName: string; aiLabel: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  const [simulated, setSimulated] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);

  const draft = () =>
    start(async () => {
      const res = await draftCourseLetterAction(id);
      if (!res.ok) return toast({ tone: "error", title: "Couldn't draft the letter", body: res.error });
      setBody(res.data.text);
      setSimulated(res.data.simulated);
      setConfirmed(false);
    });

  const sign = () =>
    start(async () => {
      const res = await accreditAiCourseAction(id, body);
      if (!res.ok) return toast({ tone: "error", title: "Couldn't accredit the course", body: res.error });
      setIssued(res.data);
      toast({ tone: "success", title: "Course accredited", body: `${studentName} can share the signed letter from their Skills Passport.` });
    });

  return (
    <Card>
      <CardHeader title="Accredit with a letter of recommendation" subtitle="Drafted from the course and the student's activity. Edit it, then sign." icon={<FileSignature className="size-5 text-iris-200" />} />
      <div className="space-y-4">
        {!issued ? (
          <Button variant="iris" onClick={draft} loading={pending}>
            <WandSparkles /> {body ? "Draft again" : "Draft the letter"}
          </Button>
        ) : null}
        <p className="text-xs text-fg-3">
          Drafted by {simulated ? "a simple template" : aiLabel}. The student&apos;s name is added on our server and never sent to an AI service.
        </p>
        {body ? (
          <>
            <Field label="Letter" htmlFor="acc-body" hint={`${body.length} / 6,000 characters. Edit freely: you are the author.`}>
              <Textarea id="acc-body" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-80" readOnly={!!issued} />
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 accent-[var(--color-sun-300)]" disabled={!!issued} />
              <span>
                I, <strong>{teacherName}</strong>, reviewed this course, confirm the letter is accurate, and sign it.
              </span>
            </label>
            {issued ? (
              <ButtonLink href={`/verify/${issued}`} target="_blank" variant="secondary">
                <ExternalLink /> View signed letter
              </ButtonLink>
            ) : (
              <Button onClick={sign} loading={pending} disabled={!confirmed || body.trim().length < 200}>
                <PenLine /> Sign & accredit
              </Button>
            )}
          </>
        ) : null}
      </div>
    </Card>
  );
}
