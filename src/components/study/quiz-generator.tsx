"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CircleCheck, Play, WandSparkles } from "lucide-react";
import { saveQuizAction } from "@/actions/ai";
import { generateQuiz } from "@/lib/ai/browser";
import { OriginBadge } from "@/components/ui/ai-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { EmptyState, Notice, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import type { GeneratedQuestion } from "@/lib/ai/types";
import { SourcePicker, emptySource, sourceReady, sourceSpec, type DocOption } from "./source-picker";

type Generated = { questions: GeneratedQuestion[]; sourceTitle: string; documentId: string | null; subjectId: string | null; simulated: boolean };

export function QuizGenerator({ docs, initialDocId, initialKind, disabled }: { docs: DocOption[]; initialDocId: string | null; initialKind: "quiz" | "practice_test"; disabled: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [source, setSource] = useState(() => emptySource(docs, initialDocId));
  const [count, setCount] = useState(initialKind === "practice_test" ? 10 : 6);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [types, setTypes] = useState<("mcq" | "true_false" | "short")[]>(["mcq", "true_false", "short"]);
  const [kind, setKind] = useState(initialKind);
  const [minutes, setMinutes] = useState(15);
  const [topic, setTopic] = useState("");
  const [gen, setGen] = useState<Generated | null>(null);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  const [saving, startSave] = useTransition();

  const toggle = (t: "mcq" | "true_false" | "short") => setTypes((xs) => (xs.includes(t) ? xs.filter((x) => x !== t) : [...xs, t]));

  const generate = () =>
    start(async () => {
      const res = await generateQuiz(sourceSpec(source), { count, difficulty, types, topic: topic || undefined });
      if (!res.ok) return toast({ tone: "error", title: "Couldn't generate questions", body: res.error });
      setGen(res.data);
      setTitle(`${kind === "practice_test" ? "Practice test" : "Quiz"}: ${res.data.sourceTitle}`);
    });

  const save = () =>
    startSave(async () => {
      if (!gen) return;
      const res = await saveQuizAction({
        title,
        questions: gen.questions.map((q) => ({ ...q, options: q.options })),
        difficulty,
        kind,
        timeLimitS: kind === "practice_test" ? minutes * 60 : null,
        documentId: gen.documentId,
        subjectId: gen.subjectId,
        topic: topic || gen.sourceTitle,
        simulated: gen.simulated,
      });
      if (!res.ok) return toast({ tone: "error", title: "Couldn't save", body: res.error });
      toast({ tone: "success", title: "Saved to your quizzes" });
      router.push(`/app/quizzes/${res.data}`);
    });

  return (
    <div className="grid gap-5 @4xl:grid-cols-[minmax(0,380px)_1fr]">
      <Card className="h-fit">
        <CardHeader title="Build a quiz" subtitle="Questions come from the material you choose" />
        <div className="space-y-4">
          <SourcePicker docs={docs} value={source} onChange={setSource} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" htmlFor="qg-kind">
              <Select id="qg-kind" value={kind} onChange={(e) => setKind(e.target.value as "quiz" | "practice_test")}>
                <option value="quiz">Quiz</option>
                <option value="practice_test">Practice test</option>
              </Select>
            </Field>
            <Field label="Questions" htmlFor="qg-count">
              <Select id="qg-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[3, 5, 6, 8, 10, 12, 15].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Difficulty" htmlFor="qg-diff">
              <Select id="qg-diff" value={difficulty} onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </Select>
            </Field>
            {kind === "practice_test" ? (
              <Field label="Time limit" htmlFor="qg-time">
                <Select id="qg-time" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                  {[0, 10, 15, 20, 30, 45].map((m) => (
                    <option key={m} value={m}>
                      {m ? `${m} min` : "Untimed"}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="Focus (optional)" htmlFor="qg-topic">
                <Input id="qg-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. limiting factors" />
              </Field>
            )}
          </div>
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-fg-2">Question types</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["mcq", "Multiple choice"],
                  ["true_false", "True / false"],
                  ["short", "Short answer"],
                ] as const
              ).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={types.includes(t)}
                  onClick={() => toggle(t)}
                  className={types.includes(t) ? "rounded-full bg-sun-200 px-3 py-1.5 text-xs font-semibold text-ink-950" : "rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-fg-2"}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <Button className="w-full" onClick={generate} loading={pending} disabled={disabled || !types.length || !sourceReady(source)}>
            <WandSparkles /> Generate questions
          </Button>
          {kind === "practice_test" ? <p className="text-[11px] text-fg-3">Practice tests are for revision only and are not official examinations.</p> : null}
        </div>
      </Card>

      <div>
        {pending ? (
          <Card aria-busy>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="mb-3 h-16 w-full" />
            ))}
          </Card>
        ) : gen ? (
          <Card className="animate-fade-up">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <OriginBadge origin={gen.simulated ? "simulated" : "ai"} />
              <Badge>{gen.questions.length} questions</Badge>
              <Badge tone={difficulty === "hard" ? "ember" : difficulty === "medium" ? "iris" : "neutral"}>{difficulty}</Badge>
            </div>
            <Field label="Title" htmlFor="qg-title" className="mb-4">
              <Input id="qg-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
            </Field>
            <Notice tone="info" className="mb-4">
              Answers are hidden while you take the quiz. Preview the questions below, then start when you're ready.
            </Notice>
            <ol className="space-y-2.5">
              {gen.questions.map((q, i) => (
                <li key={i} className="rounded-2xl border border-line bg-ink-900/60 px-4 py-3">
                  <p className="text-xs font-semibold text-fg-3">
                    Q{i + 1} · {q.type === "mcq" ? "Multiple choice" : q.type === "true_false" ? "True / false" : "Short answer"} · {q.topic}
                  </p>
                  <p className="mt-1 text-sm">{q.prompt}</p>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={save} loading={saving}>
                <Play /> Save & start
              </Button>
              <Button variant="ghost" onClick={generate} disabled={pending}>
                Regenerate
              </Button>
            </div>
          </Card>
        ) : (
          <EmptyState icon={<CircleCheck />} title="Generated questions appear here" className="h-full min-h-72">
            Pick a source and options. You'll get explanations for every answer after you finish.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
