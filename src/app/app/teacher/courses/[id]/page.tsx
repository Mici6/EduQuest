import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { CourseLetterComposer, CourseReviewPanel } from "@/components/courses/course-review";
import { GrantStatusCard } from "@/components/courses/grant-status";
import { RichText } from "@/components/study/rich-text";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { DomainError } from "@/lib/auth/errors";
import { publicConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { aiCourseView, grantBudget, maxGrant } from "@/lib/domain/ai-courses";
import { cn } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Review course" };

export default async function TeacherCoursePage({ params }: PageProps<"/app/teacher/courses/[id]">) {
  const actor = await requireActor(["teacher"]);
  const { id } = await params;
  const db = getDb();
  let c;
  try {
    c = aiCourseView(db, actor, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const budget = grantBudget(db, actor.schoolId);

  const side =
    c.status === "pending_review" ? (
      <CourseReviewPanel id={c.id} grantRequested={c.grant.status === "requested" ? c.grant.requested : 0} grantMax={maxGrant(db, actor.schoolId)} currency={budget.currency} />
    ) : c.status === "completed" ? (
      <CourseLetterComposer id={c.id} studentName={c.student} teacherName={actor.displayName} aiLabel={publicConfig().aiModel ?? "the AI"} />
    ) : c.status === "accredited" && c.letterId ? (
      <Notice tone="success" title="Accredited">
        You signed the letter for this course.{" "}
        <ButtonLink href={`/verify/${c.letterId}`} target="_blank" variant="secondary" size="sm" className="mt-3">
          <ExternalLink /> View letter
        </ButtonLink>
      </Notice>
    ) : c.status === "approved" ? (
      <Notice tone="info" title="Approved">
        {c.student} is studying it ({c.lessons.filter((l) => l.done).length}/{c.lessons.length} lessons). You&apos;ll be asked to accredit it once they pass the quiz.
      </Notice>
    ) : (
      <Notice tone="warn" title="Sent back">
        {c.reviewNote}
      </Notice>
    );

  return (
    <div>
      <PageHeader eyebrow={`AI course for ${c.student} · topic “${c.topic}”`} title={c.title} description={c.summary} />
      <div className="grid gap-5 @4xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="order-2 space-y-4 @4xl:order-1">
          {c.lessons.map((l, i) => (
            <Card key={i}>
              <CardHeader title={`Lesson ${i + 1}: ${l.title}`} />
              <div className="text-sm leading-relaxed text-fg-2">
                <RichText text={l.body ?? ""} />
              </div>
            </Card>
          ))}
          <Card>
            <CardHeader title="Final quiz" subtitle="Correct answers are highlighted. Students need 70% to pass." />
            <ol className="space-y-4">
              {c.quiz.map((q, i) => (
                <li key={i}>
                  <p className="text-sm font-semibold">
                    {i + 1}. {q.prompt}
                  </p>
                  <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {q.options.map((o) => (
                      <li key={o} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-sm", "answer" in q && q.answer === o ? "border-mint/40 bg-mint/10" : "border-line")}>
                        {"answer" in q && q.answer === o ? <CheckCircle2 className="size-4 shrink-0 text-mint" aria-label="Correct answer" /> : null}
                        {o}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="order-1 space-y-4 @4xl:order-2">
          <GrantStatusCard grant={c.grant} currency={budget.currency} />
          <div className="flex flex-wrap gap-1.5">
            {c.skills.map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
            {c.bestScore != null ? <Badge tone="mint">Best score {c.bestScore}%</Badge> : null}
          </div>
          {side}
        </div>
      </div>
    </div>
  );
}
