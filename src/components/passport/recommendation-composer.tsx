"use client";

import { useState, useTransition } from "react";
import { ExternalLink, FileSignature, PenLine, WandSparkles } from "lucide-react";
import { draftRecommendationAction, issueRecommendationAction } from "@/actions/passport";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

export function RecommendationComposer({ studentId, studentName, teacherName, eligible, daysLeft, aiLabel }: { studentId: string; studentName: string; teacherName: string; eligible: boolean; daysLeft: number; aiLabel: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [purpose, setPurpose] = useState("university");
  const [recipient, setRecipient] = useState("");
  const [body, setBody] = useState("");
  const [simulated, setSimulated] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);

  if (!eligible) {
    return (
      <Card>
        <CardHeader title="Recommendation letter" icon={<FileSignature className="size-5 text-iris-200" />} />
        <Notice tone="info">
          Letters can be written after one year of activity in EduQuest, so they rest on a full year of data. {studentName} becomes eligible in {daysLeft} days.
        </Notice>
      </Card>
    );
  }

  const draft = () =>
    start(async () => {
      const res = await draftRecommendationAction(studentId, purpose, recipient);
      if (!res.ok) return toast({ tone: "error", title: "Couldn't draft the letter", body: res.error });
      setBody(res.data.text);
      setSimulated(res.data.simulated);
      setConfirmed(false);
    });

  const issue = () =>
    start(async () => {
      const res = await issueRecommendationAction(studentId, { purpose, recipient, body });
      if (!res.ok) return toast({ tone: "error", title: "Couldn't issue the letter", body: res.error });
      setIssued(res.data);
      toast({ tone: "success", title: "Letter signed and issued", body: `${studentName} can now attach it from their Skills Passport.` });
    });

  return (
    <Card>
      <CardHeader title="Recommendation letter" subtitle="Drafted from this student's verified activity. Edit it, then sign." icon={<FileSignature className="size-5 text-iris-200" />} />
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Purpose" htmlFor="rec-purpose">
            <Select id="rec-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              <option value="university">University application</option>
              <option value="scholarship">Scholarship</option>
              <option value="volunteering">Volunteering programme</option>
            </Select>
          </Field>
          <Field label="Addressed to (optional)" htmlFor="rec-to">
            <Input id="rec-to" value={recipient} maxLength={120} onChange={(e) => setRecipient(e.target.value)} placeholder="Admissions Committee" />
          </Field>
        </div>
        <Button variant="iris" onClick={draft} loading={pending}>
          <WandSparkles /> {body ? "Draft again" : "Draft from app data"}
        </Button>
        <p className="text-xs text-fg-3">
          Drafted by {simulated ? "a simple template" : aiLabel}. Only activity facts are used; the student&apos;s name is added on our server and never sent to an AI service.
        </p>
        {body ? (
          <>
            <Field label="Letter" htmlFor="rec-body" hint={`${body.length} / 6,000 characters. Edit freely: you are the author.`}>
              <Textarea id="rec-body" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-80" />
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 accent-[var(--color-sun-300)]" />
              <span>
                I, <strong>{teacherName}</strong>, have read this letter, confirm it is accurate, and sign it as {studentName}&apos;s homeroom teacher.
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={issue} loading={pending} disabled={!confirmed || body.trim().length < 200}>
                <PenLine /> Sign & issue
              </Button>
              {issued ? (
                <ButtonLink href={`/verify/${issued}`} target="_blank" variant="secondary">
                  <ExternalLink /> View signed letter
                </ButtonLink>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </Card>
  );
}
