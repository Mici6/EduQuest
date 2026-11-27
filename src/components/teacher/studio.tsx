"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, FileQuestion, Layers, NotebookPen, Plus, Save, ScrollText, Send, Trash2, WandSparkles } from "lucide-react";
import { deleteContentAction, publishContentAction, saveFlashcardSetAction, saveQuizAction, updateQuizAction } from "@/actions/ai";
import { generateSummary, generateFlashcards, generateQuiz } from "@/lib/ai/browser";
import { SourcePicker, emptySource, sourceReady, sourceSpec, type DocOption } from "@/components/study/source-picker";
import { OriginBadge } from "@/components/ui/ai-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState, Notice, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import type { Summary } from "@/lib/ai/types";
import { NewAssignmentButton } from "./assignment-tools";

export type EditableQuestion = { type: "mcq" | "true_false" | "short"; prompt: string; options: string[]; answer: string; explanation: string; topic: string };
type Output = "summary" | "flashcards" | "quiz" | "practice_test" | "homework";
type Pair = { class_id: string; class_name: string; subject_id: string; subject_name: string };

function homeworkFrom(summary: Summary, title: string) {
  const qs = summary.keyPoints.slice(0, 4).map((k, i) => `${i + 1}. Explain in your own words, with an example: ${k}`);
  const defs = summary.definitions.slice(0, 2).map((d, i) => `${qs.length + i + 1}. Define “${d.term}” and use it correctly in a sentence.`);
  return { title: `Revision task: ${title}`, description: `Use the lesson “${title}” to answer the following:\n\n${[...qs, ...defs].join("\n")}\n\nWrite in full sentences and show your reasoning.` };
}

export function QuestionEditor({ questions, onChange }: { questions: EditableQuestion[]; onChange: (q: EditableQuestion[]) => void }) {
  const set = (i: number, patch: Partial<EditableQuestion>) => onChange(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  return (
    <ol className="space-y-3">
      {questions.map((q, i) => (
        <li key={i} className="rounded-2xl border border-line bg-ink-900/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Badge tone="iris">
              Q{i + 1} · {q.type === "mcq" ? "Multiple choice" : q.type === "true_false" ? "True / false" : "Short answer"}
            </Badge>
            <Button variant="ghost" size="icon-sm" aria-label={`Remove question ${i + 1}`} onClick={() => onChange(questions.filter((_, j) => j !== i))}>
              <Trash2 />
            </Button>
          </div>
          <div className="grid gap-3">
            <Field label="Question" htmlFor={`q${i}-p`}>
              <Textarea id={`q${i}-p`} rows={2} value={q.prompt} onChange={(e) => set(i, { prompt: e.target.value })} className="min-h-0" />
            </Field>
            {q.type === "mcq" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((o, oi) => (
                  <Field key={oi} label={`Option ${String.fromCharCode(65 + oi)}`} htmlFor={`q${i}-o${oi}`}>
                    <Input
                      id={`q${i}-o${oi}`}
                      value={o}
                      onChange={(e) => {
                        const options = q.options.map((x, k) => (k === oi ? e.target.value : x));
                        set(i, { options, answer: q.answer === o ? e.target.value : q.answer });
                      }}
                    />
                  </Field>
                ))}
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Correct answer" htmlFor={`q${i}-a`} hint={q.type === "short" ? "Separate acceptable alternatives with |" : undefined}>
                {q.type === "short" ? (
                  <Input id={`q${i}-a`} value={q.answer} onChange={(e) => set(i, { answer: e.target.value })} />
                ) : (
                  <Select id={`q${i}-a`} value={q.answer} onChange={(e) => set(i, { answer: e.target.value })}>
                    {(q.type === "true_false" ? ["True", "False"] : q.options).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Topic" htmlFor={`q${i}-t`}>
                <Input id={`q${i}-t`} value={q.topic} onChange={(e) => set(i, { topic: e.target.value })} />
              </Field>
            </div>
            <Field label="Explanation shown after answering" htmlFor={`q${i}-e`}>
              <Textarea id={`q${i}-e`} rows={2} value={q.explanation} onChange={(e) => set(i, { explanation: e.target.value })} className="min-h-0" />
            </Field>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function StudioWorkspace({ docs, pairs, initialDocId, disabled }: { docs: DocOption[]; pairs: Pair[]; initialDocId: string | null; disabled: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [source, setSource] = useState(() => emptySource(docs, initialDocId));
  const [output, setOutput] = useState<Output>("quiz");
  const [count, setCount] = useState(8);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [summary, setSummary] = useState<{ summary: Summary; simulated: boolean; sourceTitle: string } | null>(null);
  const [cards, setCards] = useState<{ front: string; back: string }[] | null>(null);
  const [questions, setQuestions] = useState<EditableQuestion[] | null>(null);
  const [meta, setMeta] = useState<{ title: string; documentId: string | null; subjectId: string | null; simulated: boolean } | null>(null);
  const [pending, start] = useTransition();
  const [saving, startSave] = useTransition();

  const reset = () => {
    setSummary(null);
    setCards(null);
    setQuestions(null);
    setMeta(null);
  };

  const generate = () =>
    start(async () => {
      reset();
      const spec = sourceSpec(source);
      if (output === "summary" || output === "homework") {
        const res = await generateSummary(spec, { length: "detailed", format: "revision" });
        if (!res.ok) return toast({ tone: "error", title: "Generation failed", body: res.error });
        setSummary(res.data);
      } else if (output === "flashcards") {
        const res = await generateFlashcards(spec, count);
        if (!res.ok) return toast({ tone: "error", title: "Generation failed", body: res.error });
        setCards(res.data.cards);
        setMeta({ title: `${res.data.sourceTitle} — flashcards`, documentId: res.data.documentId, subjectId: res.data.subjectId, simulated: res.data.simulated });
      } else {
        const res = await generateQuiz(spec, { count, difficulty, types: ["mcq", "true_false", "short"] });
        if (!res.ok) return toast({ tone: "error", title: "Generation failed", body: res.error });
        setQuestions(res.data.questions.map((q) => ({ ...q, options: q.type === "true_false" ? ["True", "False"] : q.options })));
        setMeta({ title: `${output === "practice_test" ? "Practice test" : "Quiz"}: ${res.data.sourceTitle}`, documentId: res.data.documentId, subjectId: res.data.subjectId, simulated: res.data.simulated });
      }
    });

  const saveDraft = () =>
    startSave(async () => {
      if (!meta) return;
      const res = cards
        ? await saveFlashcardSetAction({ title: meta.title, cards, documentId: meta.documentId, subjectId: meta.subjectId, simulated: meta.simulated })
        : await saveQuizAction({
            title: meta.title,
            questions: questions ?? [],
            difficulty,
            kind: output === "practice_test" ? "practice_test" : "quiz",
            timeLimitS: output === "practice_test" ? 20 * 60 : null,
            documentId: meta.documentId,
            subjectId: meta.subjectId,
            simulated: meta.simulated,
          });
      if (!res.ok) return toast({ tone: "error", title: "Couldn't save draft", body: res.error });
      toast({ tone: "success", title: "Saved as draft", body: "Review it under Drafts, then publish it to a class." });
      reset();
      router.push("/app/teacher/studio?tab=drafts");
    });

  return (
    <div className="grid gap-5 @4xl:grid-cols-[minmax(0,380px)_1fr]">
      <Card className="h-fit">
        <CardHeader title="1 · Choose source" />
        <SourcePicker docs={docs} value={source} onChange={setSource} />
        <div className="mt-6">
          <CardHeader title="2 · Choose output" className="mb-3" />
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["quiz", "Quiz", FileQuestion],
                ["practice_test", "Practice test", ScrollText],
                ["flashcards", "Flashcards", Layers],
                ["summary", "Summary", WandSparkles],
                ["homework", "Homework", NotebookPen],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={output === value}
                onClick={() => setOutput(value)}
                className={output === value ? "flex items-center gap-2 rounded-2xl bg-sun-200 px-3 py-2.5 text-sm font-semibold text-ink-950" : "flex items-center gap-2 rounded-2xl border border-line px-3 py-2.5 text-sm font-semibold text-fg-2 hover:text-fg"}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
          {output === "quiz" || output === "practice_test" || output === "flashcards" ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label={output === "flashcards" ? "Cards" : "Questions"} htmlFor="st-count">
                <Select id="st-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                  {[5, 8, 10, 12, 15, 20].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>
              {output !== "flashcards" ? (
                <Field label="Difficulty" htmlFor="st-diff">
                  <Select id="st-diff" value={difficulty} onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </Select>
                </Field>
              ) : null}
            </div>
          ) : null}
        </div>
        <Button className="mt-5 w-full" onClick={generate} loading={pending} disabled={disabled || !sourceReady(source)}>
          <WandSparkles /> Generate
        </Button>
      </Card>

      <div>
        {pending ? (
          <Card aria-busy>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="mb-3 h-16 w-full" />
            ))}
          </Card>
        ) : summary ? (
          <Card className="animate-fade-up">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <OriginBadge origin={summary.simulated ? "simulated" : "ai"} />
              {output === "homework" || output === "summary" ? (
                <NewAssignmentButton key={summary.sourceTitle + output} pairs={pairs} preset={output === "homework" ? homeworkFrom(summary.summary, summary.sourceTitle) : null} />
              ) : null}
            </div>
            {output === "homework" ? (
              <Notice tone="info" className="mb-4">
                A homework draft was prepared from this summary and opened for review. Nothing is published until you press Publish.
              </Notice>
            ) : null}
            <h2 className="font-display text-xl font-semibold">{summary.summary.title}</h2>
            <p className="mt-2 text-sm text-fg-2">{summary.summary.overview}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {summary.summary.keyPoints.map((k, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sun-300" aria-hidden />
                  {k}
                </li>
              ))}
            </ul>
            {summary.summary.definitions.length ? (
              <dl className="mt-4 grid gap-2 @2xl:grid-cols-2">
                {summary.summary.definitions.map((d, i) => (
                  <div key={i} className="rounded-2xl border border-line bg-ink-900/60 p-3 text-sm">
                    <dt className="font-semibold">{d.term}</dt>
                    <dd className="text-fg-2">{d.definition}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </Card>
        ) : cards || questions ? (
          <Card className="animate-fade-up">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <OriginBadge origin={meta?.simulated ? "simulated" : "ai"} />
              <span className="text-xs text-fg-3">Review and edit before saving. Students never see drafts.</span>
            </div>
            <Field label="Title" htmlFor="st-title" className="mb-4">
              <Input id="st-title" value={meta?.title ?? ""} onChange={(e) => setMeta((m) => (m ? { ...m, title: e.target.value } : m))} maxLength={140} />
            </Field>
            {cards ? (
              <ol className="space-y-2.5">
                {cards.map((c, i) => (
                  <li key={i} className="grid gap-2 rounded-2xl border border-line bg-ink-900/60 p-3 @2xl:grid-cols-[1fr_1.4fr_auto]">
                    <Textarea aria-label={`Card ${i + 1} front`} rows={2} value={c.front} onChange={(e) => setCards(cards.map((x, j) => (j === i ? { ...x, front: e.target.value } : x)))} className="min-h-0" />
                    <Textarea aria-label={`Card ${i + 1} back`} rows={2} value={c.back} onChange={(e) => setCards(cards.map((x, j) => (j === i ? { ...x, back: e.target.value } : x)))} className="min-h-0" />
                    <Button variant="ghost" size="icon-sm" aria-label={`Remove card ${i + 1}`} onClick={() => setCards(cards.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
                <li>
                  <Button variant="secondary" size="sm" onClick={() => setCards([...cards, { front: "", back: "" }])}>
                    <Plus /> Add card
                  </Button>
                </li>
              </ol>
            ) : (
              <QuestionEditor questions={questions!} onChange={setQuestions} />
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={saveDraft} loading={saving}>
                <Save /> Save as draft
              </Button>
              <Button variant="ghost" onClick={reset}>
                Discard
              </Button>
            </div>
          </Card>
        ) : (
          <EmptyState icon={<WandSparkles />} title="Generated content appears here for review" className="h-full min-h-80">
            AI-generated material is never published automatically. You edit it, save a draft, and choose when (and to which class) to publish.
          </EmptyState>
        )}
      </div>
    </div>
  );
}

export type Draft = {
  kind: "quiz" | "flashcards";
  id: string;
  title: string;
  origin: string;
  status: string;
  className: string | null;
  count: number;
  subject: string | null;
  questions?: EditableQuestion[];
};

export function DraftList({ drafts, classes }: { drafts: Draft[]; classes: { id: string; name: string }[] }) {
  const toast = useToast();
  const [publishing, setPublishing] = useState<Draft | null>(null);
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [editQs, setEditQs] = useState<EditableQuestion[]>([]);
  const [editTitle, setEditTitle] = useState("");
  const [deleting, setDeleting] = useState<Draft | null>(null);
  const [pending, start] = useTransition();

  if (!drafts.length) return <EmptyState icon={<Save />} title="No drafts">Generated content you save appears here for review.</EmptyState>;

  return (
    <>
      <ul className="space-y-3">
        {drafts.map((d) => (
          <li key={d.kind + d.id} className="surface flex flex-col gap-3 rounded-[22px] p-4 @2xl:flex-row @2xl:items-center">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-fg-2">
              {d.kind === "quiz" ? <FileQuestion className="size-5" aria-hidden /> : <Layers className="size-5" aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{d.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-3">
                <OriginBadge origin={d.origin} />
                <span>
                  {d.count} {d.kind === "quiz" ? "questions" : "cards"}
                </span>
                {d.subject ? <span>· {d.subject}</span> : null}
                {d.status === "published" ? <Badge tone="mint">Published · {d.className}</Badge> : <Badge tone="sun">Draft</Badge>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={d.kind === "quiz" ? `/app/quizzes/${d.id}` : `/app/flashcards/${d.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-fg-2 hover:text-fg">
                <Eye className="size-3.5" aria-hidden /> Preview
              </Link>
              {d.kind === "quiz" && d.questions ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditing(d);
                    setEditQs(d.questions!);
                    setEditTitle(d.title);
                  }}
                >
                  Edit
                </Button>
              ) : null}
              {d.status !== "published" ? (
                <Button size="sm" onClick={() => setPublishing(d)}>
                  <Send /> Publish
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => setDeleting(d)} aria-label={`Delete ${d.title}`}>
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={!!publishing}
        onClose={() => setPublishing(null)}
        title="Publish to a class"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPublishing(null)}>
              Cancel
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                start(async () => {
                  const res = await publishContentAction(publishing!.kind, publishing!.id, classId);
                  if (!res.ok) return toast({ tone: "error", title: "Couldn't publish", body: res.error });
                  toast({ tone: "success", title: "Published", body: `Visible to ${res.data} students.` });
                  setPublishing(null);
                })
              }
            >
              I've reviewed it — publish
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-fg-2">Please confirm you've checked “{publishing?.title}” for accuracy. Students will see it as material from you.</p>
        <Field label="Class" htmlFor="pub-class">
          <Select id="pub-class" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </Dialog>

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit quiz"
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                start(async () => {
                  const res = await updateQuizAction(editing!.id, { title: editTitle, questions: editQs });
                  if (!res.ok) return toast({ tone: "error", title: "Couldn't save", body: res.error });
                  toast({ tone: "success", title: "Quiz updated" });
                  setEditing(null);
                })
              }
            >
              Save changes
            </Button>
          </>
        }
      >
        <Field label="Title" htmlFor="ed-title" className="mb-4">
          <Input id="ed-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
        </Field>
        <QuestionEditor questions={editQs} onChange={setEditQs} />
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this content?"
        confirmLabel="Delete"
        variant="danger"
        pending={pending}
        onConfirm={() =>
          start(async () => {
            const res = await deleteContentAction(deleting!.kind, deleting!.id);
            setDeleting(null);
            toast(res.ok ? { tone: "success", title: "Deleted" } : { tone: "error", title: "Couldn't delete", body: res.error });
          })
        }
      >
        “{deleting?.title}” will be removed{deleting?.status === "published" ? ", including for students who can currently see it" : ""}.
      </ConfirmDialog>
    </>
  );
}
