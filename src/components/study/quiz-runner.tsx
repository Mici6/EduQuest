"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, CircleCheck, CircleX, Clock, Lightbulb, Play, RotateCcw, Sparkles } from "lucide-react";
import { refreshAction, submitQuizAction } from "@/actions/student";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/format";
import { celebrations } from "@/components/student/celebrate";

type Question = { id: string; type: "mcq" | "true_false" | "short"; prompt: string; options: string[]; topic: string | null };
type Result = {
  score: number;
  total: number;
  xp: number;
  preview: boolean;
  revisionTopics: string[];
  results: { questionId: string; prompt: string; given: string | null; correctAnswer: string; correct: boolean; explanation: string }[];
};

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function QuizRunner({
  quiz,
  questions,
  isTeacher,
}: {
  quiz: { id: string; title: string; difficulty: string; kind: string; time_limit_s: number | null; topic: string | null };
  questions: Question[];
  isTeacher: boolean;
}) {
  const toast = useToast();
  const [phase, setPhase] = useState<"intro" | "run" | "result">("intro");
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [left, setLeft] = useState(quiz.time_limit_s ?? 0);
  const [result, setResult] = useState<Result | null>(null);
  const startedAt = useRef(0);
  const [pending, start] = useTransition();

  const submit = useCallback(() => {
    if (pending) return;
    start(async () => {
      const res = await submitQuizAction(quiz.id, answers, Math.round((Date.now() - startedAt.current) / 1000));
      if (!res.ok) return toast({ tone: "error", title: "Couldn't submit", body: res.error });
      setResult(res.data);
      setPhase("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (res.data.xp) toast({ tone: "reward", title: `+${res.data.xp} XP`, body: `${res.data.score}/${res.data.total} correct` });
      for (const c of celebrations(res.data.before, res.data.after)) toast({ tone: "reward", ...c });
    });
  }, [answers, pending, quiz.id, toast]);

  useEffect(() => {
    if (phase !== "run" || !quiz.time_limit_s) return;
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, [phase, quiz.time_limit_s]);

  useEffect(() => {
    if (phase === "run" && quiz.time_limit_s && left === 0) {
      toast({ tone: "info", title: "Time's up", body: "Your answers were submitted automatically." });
      submit();
    }
  }, [left, phase, quiz.time_limit_s, submit, toast]);

  const q = questions[i];
  const answered = Object.values(answers).filter((a) => a.trim()).length;

  if (phase === "intro") {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <span className="grad-ember mx-auto inline-flex size-16 items-center justify-center rounded-3xl text-ink-950">
          <Play className="size-7" aria-hidden />
        </span>
        <h2 className="mt-5 font-display text-2xl font-semibold">{quiz.title}</h2>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Badge>{questions.length} questions</Badge>
          <Badge tone={quiz.difficulty === "hard" ? "ember" : quiz.difficulty === "medium" ? "iris" : "neutral"}>{quiz.difficulty}</Badge>
          {quiz.time_limit_s ? (
            <Badge tone="sun" icon={<Clock />}>
              {Math.round(quiz.time_limit_s / 60)} min
            </Badge>
          ) : (
            <Badge>Untimed</Badge>
          )}
        </div>
        {quiz.kind === "practice_test" ? <Notice tone="info" className="mt-5 text-left">This is a practice test for revision. It is not an official examination and doesn't affect your grades.</Notice> : null}
        {isTeacher ? <Notice tone="ai" className="mt-5 text-left">Teacher preview: your answers are graded but not recorded and no XP is awarded.</Notice> : null}
        <p className="mt-5 text-sm text-fg-2">You'll see the correct answers and explanations after you submit. XP is awarded once per quiz per day.</p>
        <Button
          size="lg"
          className="mt-6"
          onClick={() => {
            startedAt.current = Date.now();
            setPhase("run");
          }}
        >
          Start {quiz.kind === "practice_test" ? "test" : "quiz"}
        </Button>
      </Card>
    );
  }

  if (phase === "result" && result) {
    const pct = Math.round((result.score / result.total) * 100);
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <Card className="text-center">
          <ProgressRing value={result.score / result.total} size={140} stroke={12} tone={pct >= 80 ? "mint" : pct >= 50 ? "sun" : "ember"} className="mx-auto">
            <div>
              <p className="font-display text-3xl font-semibold">{pct}%</p>
              <p className="text-xs text-fg-3">
                {result.score}/{result.total} correct
              </p>
            </div>
          </ProgressRing>
          <h2 className="mt-5 font-display text-2xl font-semibold">{pct === 100 ? "Perfect score!" : pct >= 80 ? "Great work!" : pct >= 50 ? "Good effort — keep going" : "Every attempt helps you learn"}</h2>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {result.xp ? (
              <Badge tone="sun" icon={<Sparkles />}>
                +{result.xp} XP
              </Badge>
            ) : (
              <Badge>{result.preview ? "Preview — not recorded" : "XP already earned for this quiz today"}</Badge>
            )}
          </div>
          {result.revisionTopics.length ? (
            <div className="mx-auto mt-5 max-w-lg rounded-2xl border border-line bg-ink-900/60 p-4 text-left">
              <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold">
                <Lightbulb className="size-4 text-sun-300" aria-hidden /> Worth revisiting
              </p>
              <div className="flex flex-wrap gap-2">
                {result.revisionTopics.map((t) => (
                  <Link key={t} href={`/app/study/chat?q=${encodeURIComponent(`Help me understand ${t} in ${quiz.topic ?? quiz.title}`)}`} className="rounded-full bg-iris-400/15 px-3 py-1.5 text-xs font-semibold text-iris-200 hover:bg-iris-400/25">
                    {t} → ask the tutor
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setAnswers({});
                setI(0);
                setLeft(quiz.time_limit_s ?? 0);
                setResult(null);
                setPhase("intro");
              }}
            >
              <RotateCcw /> Retake
            </Button>
            <ButtonLink href={isTeacher ? "/app/teacher/studio?tab=drafts" : "/app/quizzes"} onClick={() => void refreshAction()}>
              Done
            </ButtonLink>
          </div>
        </Card>
        <ol className="space-y-3">
          {result.results.map((r, idx) => (
            <li key={r.questionId}>
              <Card className={cn("!p-4 sm:!p-5", r.correct ? "!border-mint/30" : "!border-rose/30")}>
                <div className="flex items-start gap-3">
                  {r.correct ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-mint" aria-label="Correct" /> : <CircleX className="mt-0.5 size-5 shrink-0 text-rose" aria-label="Incorrect" />}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {idx + 1}. {r.prompt}
                    </p>
                    <p className="mt-2 text-xs text-fg-2">
                      Your answer: <span className={r.correct ? "text-mint" : "text-rose"}>{r.given || "—"}</span>
                      {!r.correct ? (
                        <>
                          {" "}
                          · Correct: <span className="text-mint">{r.correctAnswer}</span>
                        </>
                      ) : null}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-fg-2">{r.explanation}</p>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (!q) return null;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs tabular-nums text-fg-3">
          {i + 1}/{questions.length}
        </span>
        <ProgressBar value={(i + 1) / questions.length} size="sm" label="Quiz progress" />
        {quiz.time_limit_s ? (
          <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums", left < 60 ? "bg-rose/20 text-rose" : "bg-white/[0.06] text-fg-2")} role="timer" aria-live={left < 60 ? "polite" : "off"}>
            <Clock className="size-3.5" aria-hidden /> {fmt(left)}
          </span>
        ) : null}
      </div>
      <Card key={q.id} className="animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-wider text-sun-300">{q.type === "mcq" ? "Multiple choice" : q.type === "true_false" ? "True or false" : "Short answer"}</p>
        <h2 className="mt-2 font-display text-xl font-semibold leading-snug" id={`q-${q.id}`}>
          {q.prompt}
        </h2>
        {q.type === "short" ? (
          <div className="mt-5">
            <label htmlFor={`a-${q.id}`} className="sr-only">
              Your answer
            </label>
            <Input
              id={`a-${q.id}`}
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if (i < questions.length - 1) setI(i + 1);
                else submit();
              }}
              placeholder="Type your answer"
              autoFocus
              maxLength={300}
            />
          </div>
        ) : (
          <div role="radiogroup" aria-labelledby={`q-${q.id}`} className={cn("mt-5 grid gap-2.5", q.type === "true_false" && "grid-cols-2")}>
            {q.options.map((o, oi) => {
              const selected = answers[q.id] === o;
              return (
                <button
                  key={o}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: o }))}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition-all",
                    selected ? "border-sun-300 bg-sun-300/[0.12] text-fg" : "border-line bg-ink-900/60 text-fg-2 hover:border-line-strong hover:text-fg",
                  )}
                >
                  <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", selected ? "bg-sun-200 text-ink-950" : "bg-white/[0.06]")}>
                    {q.type === "true_false" ? (o === "True" ? "T" : "F") : String.fromCharCode(65 + oi)}
                  </span>
                  {o}
                </button>
              );
            })}
          </div>
        )}
      </Card>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>
          <ArrowLeft /> Back
        </Button>
        <span className="text-xs text-fg-3">
          {answered}/{questions.length} answered
        </span>
        {i < questions.length - 1 ? (
          <Button variant="secondary" onClick={() => setI(i + 1)}>
            Next <ArrowRight />
          </Button>
        ) : (
          <Button onClick={submit} loading={pending}>
            Submit
          </Button>
        )}
      </div>
    </div>
  );
}
