import type { Metadata } from "next";
import Link from "next/link";
import { Clock, ListChecks, Plus, Trophy } from "lucide-react";
import { OriginBadge } from "@/components/ui/ai-badge";
import { Badge, SubjectTag } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { listQuizzes, recentAttempts, type QuizView } from "@/lib/domain/study";
import { relativeTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Quizzes" };

function QuizCard({ q, mine }: { q: QuizView; mine: boolean }) {
  return (
    <Link href={`/app/quizzes/${q.id}`} className="surface group flex h-full flex-col rounded-[var(--radius-card)] p-5 transition-all hover:-translate-y-0.5 hover:border-line-strong">
      <div className="flex flex-wrap items-center gap-2">
        {q.subject_name ? <SubjectTag name={q.subject_name} color={q.subject_color!} /> : null}
        <span className="ml-auto">
          <OriginBadge origin={q.origin} />
        </span>
      </div>
      <p className="mt-3 font-display text-lg font-semibold leading-snug">{q.title}</p>
      <p className="mt-1 text-xs text-fg-3">{mine ? "Your practice quiz" : `by ${q.owner_name}`}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        <Badge>{q.questions} Qs</Badge>
        <Badge tone={q.difficulty === "hard" ? "ember" : q.difficulty === "medium" ? "iris" : "neutral"}>{q.difficulty}</Badge>
        {q.kind === "practice_test" ? (
          <Badge tone="sun" icon={<Clock />}>
            {q.time_limit_s ? `${Math.round(q.time_limit_s / 60)} min test` : "Practice test"}
          </Badge>
        ) : null}
        {q.best != null ? (
          <Badge tone="mint" icon={<Trophy />}>
            Best {q.best}%
          </Badge>
        ) : (
          <Badge tone="neutral">Not attempted</Badge>
        )}
      </div>
    </Link>
  );
}

export default async function QuizzesPage() {
  const actor = await requireActor(["student"]);
  const db = getDb();
  const quizzes = listQuizzes(db, actor);
  const teacherQuizzes = quizzes.filter((q) => q.owner_id !== actor.id);
  const mine = quizzes.filter((q) => q.owner_id === actor.id);
  const attempts = recentAttempts(db, actor, 6);
  return (
    <div>
      <PageHeader
        eyebrow="AI Study"
        title="Quizzes & practice tests"
        description="Check your understanding with instant explanations. Mistakes are part of learning — XP rewards finishing, and more for getting answers right."
        actions={
          <ButtonLink href="/app/study/quiz">
            <Plus /> Generate a quiz
          </ButtonLink>
        }
      />
      <div className="grid gap-5 @5xl:grid-cols-12">
        <div className="space-y-6 @5xl:col-span-8">
          <section>
            <h2 className="mb-3 font-display text-lg font-semibold">From your teachers</h2>
            {teacherQuizzes.length ? (
              <ul className="grid gap-4 sm:grid-cols-2">
                {teacherQuizzes.map((q) => (
                  <li key={q.id}>
                    <QuizCard q={q} mine={false} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<ListChecks />} title="No class quizzes yet" />
            )}
          </section>
          <section>
            <h2 className="mb-3 font-display text-lg font-semibold">Your practice quizzes</h2>
            {mine.length ? (
              <ul className="grid gap-4 sm:grid-cols-2">
                {mine.map((q) => (
                  <li key={q.id}>
                    <QuizCard q={q} mine />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Plus />} title="Make your own" action={<ButtonLink href="/app/study/quiz" variant="secondary" size="sm">Generate a quiz</ButtonLink>}>
                Generate a quiz from any lesson in your library.
              </EmptyState>
            )}
          </section>
        </div>
        <Card className="h-fit @5xl:col-span-4">
          <CardHeader title="Recent results" />
          {attempts.length ? (
            <ul className="space-y-2.5">
              {attempts.map((a) => (
                <li key={a.id} className="flex items-center gap-3">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white/[0.06] font-display text-sm font-semibold tabular-nums">{Math.round((a.score / a.total) * 100)}%</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-fg-3">
                      {a.score}/{a.total} · {relativeTime(a.completed_at)}
                      {a.xp_awarded ? ` · +${a.xp_awarded} XP` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-3">Your quiz history will appear here.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
