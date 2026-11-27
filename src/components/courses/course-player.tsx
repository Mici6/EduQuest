"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { completeAiLessonAction, submitAiCourseQuizAction } from "@/actions/ai-courses";
import { Award, BadgeCheck, CheckCircle2, Circle, Coins, ExternalLink, Info, Lock, RotateCcw } from "lucide-react";
import { completeLessonAction, submitCourseQuizAction, unlockCourseAction } from "@/actions/passport";
import { RichText } from "@/components/study/rich-text";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { ProgressBar } from "@/components/ui/progress";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/format";

type CourseData = {
  id: string;
  title: string;
  creditCost: number;
  skills: string[];
  note: string | null;
  unlocked: boolean;
  completedAt: string | null;
  bestScore: number | null;
  certificateId: string | null;
  lessons: { title: string; body: string | null; done: boolean }[];
  quiz: { prompt: string; options: string[] }[];
  balance: number;
};

/** Plays a catalogue mini-course, or (with aiCourseId) a teacher-approved AI course; `aside` adds cards to the side column. */
export function CoursePlayer({ course, aiCourseId, aside }: { course: CourseData; aiCourseId?: string; aside?: ReactNode }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [open, setOpen] = useState(() => Math.max(0, course.lessons.findIndex((l) => !l.done)));
  const [answers, setAnswers] = useState<string[]>(() => course.quiz.map(() => ""));
  const [result, setResult] = useState<{ correct: number; total: number; pct: number; passed: boolean; certificateId: string | null } | null>(null);
  const done = course.lessons.filter((l) => l.done).length;
  const allDone = done === course.lessons.length;
  const certificateId = result?.certificateId ?? course.certificateId;

  const unlock = () =>
    start(async () => {
      const res = await unlockCourseAction(course.id);
      setConfirm(false);
      toast(res.ok ? { tone: "success", title: "Course unlocked", body: "Start with the first lesson." } : { tone: "error", title: "Couldn't unlock", body: res.error });
    });

  const markDone = (i: number) =>
    start(async () => {
      const res = aiCourseId ? await completeAiLessonAction(aiCourseId, i) : await completeLessonAction(course.id, i);
      if (!res.ok) return toast({ tone: "error", title: "Couldn't save progress", body: res.error });
      setOpen(i + 1 < course.lessons.length ? i + 1 : -1);
    });

  const submit = () =>
    start(async () => {
      const res = aiCourseId ? await submitAiCourseQuizAction(aiCourseId, answers) : await submitCourseQuizAction(course.id, answers);
      if (!res.ok) return toast({ tone: "error", title: "Couldn't submit", body: res.error });
      setResult({ certificateId: null, ...res.data });
      if (res.data.passed)
        toast({ tone: "success", title: `Passed with ${res.data.pct}%!`, body: aiCourseId ? "Your teacher has been asked to accredit the course." : "Your certificate is in your Skills Passport." });
    });

  if (!course.unlocked) {
    const short = course.creditCost - course.balance;
    return (
      <div className="grid gap-5 @4xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="What you'll learn" subtitle={`${course.lessons.length} short lessons, then a final quiz (70% to pass).`} />
          <ol className="space-y-2">
            {course.lessons.map((l, i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3 text-sm">
                <Lock className="size-4 text-fg-3" aria-hidden />
                <span className="text-fg-3">Lesson {i + 1}</span>
                <span className="font-medium">{l.title}</span>
              </li>
            ))}
          </ol>
          {course.note ? (
            <Notice tone="info" icon={<Info />} className="mt-4">
              {course.note}
            </Notice>
          ) : null}
        </Card>
        <Card tone="sun" className="h-fit">
          <p className="text-sm font-semibold">Unlock with credits</p>
          <p className="mt-1 font-display text-4xl font-semibold">{course.creditCost}</p>
          <p className="text-sm text-ink-950/70">You have {course.balance} credits.</p>
          <Button variant="dark" className="mt-4 w-full" disabled={short > 0 || pending} onClick={() => setConfirm(true)}>
            <Coins /> {short > 0 ? `${short} more credits needed` : "Unlock course"}
          </Button>
          {short > 0 ? (
            <Link href="/app/volunteering" className="mt-3 block text-center text-sm font-semibold underline underline-offset-2">
              Earn credits by volunteering
            </Link>
          ) : null}
        </Card>
        <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={unlock} pending={pending} title={`Unlock “${course.title}”?`} confirmLabel={`Spend ${course.creditCost} credits`}>
          {course.creditCost} credits will be spent from your balance of {course.balance}. You keep access to the course after that.
        </ConfirmDialog>
      </div>
    );
  }

  return (
    <div className="grid gap-5 @4xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        {course.note ? (
          <Notice tone="info" icon={<Info />}>
            {course.note}
          </Notice>
        ) : null}
        {course.lessons.map((l, i) => (
          <Card key={i} className="!p-0">
            <button type="button" onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center gap-3 px-5 py-4 text-left" aria-expanded={open === i}>
              {l.done ? <CheckCircle2 className="size-5 shrink-0 text-mint" aria-label="Done" /> : <Circle className="size-5 shrink-0 text-fg-3" aria-label="Not done" />}
              <span className="shrink-0 text-xs font-semibold text-fg-3">Lesson {i + 1}</span>
              <span className="font-display font-semibold">{l.title}</span>
            </button>
            {open === i && l.body ? (
              <div className="border-t border-line px-5 py-4 text-sm leading-relaxed text-fg-2">
                <RichText text={l.body} />
                {!l.done ? (
                  <Button size="sm" className="mt-4" onClick={() => markDone(i)} loading={pending}>
                    <CheckCircle2 /> Mark lesson as done
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Card>
        ))}

        <Card>
          <CardHeader title="Final quiz" subtitle={allDone ? "Answer every question. 70% or more passes; you can retry." : "Finish every lesson to open the quiz."} />
          {allDone ? (
            <div className="space-y-5">
              {course.quiz.map((q, qi) => (
                <fieldset key={qi}>
                  <legend className="mb-2 text-sm font-semibold">
                    {qi + 1}. {q.prompt}
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {q.options.map((o) => (
                      <label
                        key={o}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-sm transition-colors",
                          answers[qi] === o ? "border-sun-300/60 bg-sun-300/10" : "border-line hover:border-line-strong",
                        )}
                      >
                        <input type="radio" name={`q${qi}`} value={o} checked={answers[qi] === o} onChange={() => setAnswers((a) => a.map((x, j) => (j === qi ? o : x)))} className="accent-[var(--color-sun-300)]" />
                        {o}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              {result && !result.passed ? (
                <Notice tone="warn" icon={<RotateCcw />} title={`${result.correct} of ${result.total} correct (${result.pct}%)`}>
                  You need 70% to pass. Review the lessons and try again.
                </Notice>
              ) : null}
              <Button onClick={submit} loading={pending} disabled={answers.some((a) => !a)}>
                <BadgeCheck /> Submit answers
              </Button>
            </div>
          ) : (
            <ProgressBar value={done / course.lessons.length} tone="iris" label="Lessons completed" />
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <p className="text-xs font-semibold text-fg-3">Progress</p>
          <p className="mt-1 font-display text-2xl font-semibold">
            {done} / {course.lessons.length} lessons
          </p>
          <ProgressBar value={done / course.lessons.length} tone="iris" size="sm" className="mt-3" label="Lessons completed" />
          <div className="mt-4 flex flex-wrap gap-1.5">
            {course.skills.map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
        </Card>
        {certificateId ? (
          <Card tone="iris">
            <Award className="size-6" aria-hidden />
            <p className="mt-2 font-display text-lg font-semibold">Certificate earned</p>
            <p className="text-sm text-ink-950/75">Best score: {result?.pct ?? course.bestScore}%. Sealed by your school and listed in your Skills Passport.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink href={`/verify/${certificateId}`} variant="dark" size="sm" target="_blank">
                <ExternalLink /> View certificate
              </ButtonLink>
              <ButtonLink href="/app/passport" variant="outline" size="sm" className="!border-ink-950/30 !text-ink-950">
                Passport
              </ButtonLink>
            </div>
          </Card>
        ) : null}
        {aside}
      </div>
    </div>
  );
}
