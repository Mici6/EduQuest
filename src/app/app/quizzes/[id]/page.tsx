import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuizRunner } from "@/components/study/quiz-runner";
import { OriginBadge } from "@/components/ui/ai-badge";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { DomainError } from "@/lib/auth/errors";
import { getDb } from "@/lib/db";
import { getQuizForTaking } from "@/lib/domain/study";

export const metadata: Metadata = { title: "Quiz" };

export default async function QuizPage({ params }: PageProps<"/app/quizzes/[id]">) {
  const actor = await requireActor(["student", "teacher"]);
  const { id } = await params;
  let data;
  try {
    data = getQuizForTaking(getDb(), actor, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  return (
    <div>
      <PageHeader eyebrow={data.quiz.subject_name ?? "Quiz"} title={data.quiz.title} actions={<OriginBadge origin={data.quiz.origin} />} />
      <QuizRunner
        quiz={{ id: data.quiz.id, title: data.quiz.title, difficulty: data.quiz.difficulty, kind: data.quiz.kind, time_limit_s: data.quiz.time_limit_s, topic: data.quiz.topic }}
        questions={data.questions.map((q) => ({ id: q.id, type: q.type, prompt: q.prompt, options: q.options, topic: q.topic }))}
        isTeacher={actor.role === "teacher"}
      />
    </div>
  );
}
