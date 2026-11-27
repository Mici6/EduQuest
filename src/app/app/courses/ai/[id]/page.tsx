import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink, FileSignature, Hourglass, Lock, Undo2, WandSparkles } from "lucide-react";
import { CoursePlayer } from "@/components/courses/course-player";
import { GrantStatusCard } from "@/components/courses/grant-status";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, IconChip } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { DomainError } from "@/lib/auth/errors";
import { getDb } from "@/lib/db";
import { aiCourseView, grantBudget } from "@/lib/domain/ai-courses";

export const metadata: Metadata = { title: "AI course" };

export default async function AiCoursePage({ params }: PageProps<"/app/courses/ai/[id]">) {
  const actor = await requireActor(["student"]);
  const { id } = await params;
  const db = getDb();
  let c;
  try {
    c = aiCourseView(db, actor, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const currency = grantBudget(db, actor.schoolId).currency;
  const header = (
    <PageHeader
      eyebrow={
        <span className="inline-flex items-center gap-2">
          <IconChip tone="iris" className="size-6 [&_svg]:size-3.5">
            <WandSparkles />
          </IconChip>
          AI course · reviewed by {c.reviewer}
        </span>
      }
      title={c.title}
      description={c.summary}
    />
  );

  if (c.status === "pending_review" || c.status === "rejected") {
    return (
      <div>
        {header}
        <div className="grid gap-5 @4xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <CardHeader title="What you'll learn" subtitle={`${c.lessons.length} lessons, then a final quiz (70% to pass).`} />
            <ol className="space-y-2">
              {c.lessons.map((l, i) => (
                <li key={i} className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3 text-sm">
                  <Lock className="size-4 shrink-0 text-fg-3" aria-hidden />
                  <span className="shrink-0 text-fg-3">Lesson {i + 1}</span>
                  <span className="min-w-0 font-medium">{l.title}</span>
                </li>
              ))}
            </ol>
          </Card>
          {c.status === "pending_review" ? (
            <Notice tone="info" icon={<Hourglass />} title={`Waiting for ${c.reviewer}`} className="h-fit">
              Your teacher checks the AI&apos;s lessons and quiz{c.grant.requested ? ` and your grant request (${c.grant.requested} ${currency})` : ""} first. You&apos;ll get a notification when you can start.
            </Notice>
          ) : (
            <Notice tone="warn" icon={<Undo2 />} title={`${c.reviewer} sent this course back`} className="h-fit">
              {c.reviewNote} You can create a new course from the Courses page.
            </Notice>
          )}
        </div>
      </div>
    );
  }

  const aside = (
    <>
      <GrantStatusCard grant={c.grant} currency={currency} />
      {c.status === "accredited" && c.letterId ? (
        <Card tone="iris">
          <FileSignature className="size-6" aria-hidden />
          <p className="mt-2 font-display text-lg font-semibold">Accredited by {c.reviewer}</p>
          <p className="text-sm text-ink-950/75">Your signed letter of recommendation is sealed by your school and listed in your Skills Passport.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href={`/verify/${c.letterId}`} variant="dark" size="sm" target="_blank">
              <ExternalLink /> View letter
            </ButtonLink>
            <ButtonLink href="/app/passport" variant="outline" size="sm" className="!border-ink-950/30 !text-ink-950">
              Passport
            </ButtonLink>
          </div>
        </Card>
      ) : c.status === "completed" ? (
        <Notice tone="success" icon={<Hourglass />} title="Passed! Awaiting accreditation">
          {c.reviewer} has been asked to accredit your course with a letter of recommendation.
        </Notice>
      ) : (
        <Card>
          <Badge tone="iris" icon={<FileSignature />}>
            Accreditation
          </Badge>
          <p className="mt-2 text-sm text-fg-2">Pass the quiz and {c.reviewer} will accredit this course with a signed letter of recommendation.</p>
        </Card>
      )}
    </>
  );

  return (
    <div>
      {header}
      <CoursePlayer
        aiCourseId={c.id}
        aside={aside}
        course={{
          id: c.id,
          title: c.title,
          creditCost: 0,
          skills: c.skills,
          note: c.topic.toLowerCase().includes("first aid") ? "This course doesn't replace certified first-aid training. In an emergency, call 112." : null,
          unlocked: true,
          completedAt: null,
          bestScore: c.bestScore,
          certificateId: null,
          lessons: c.lessons,
          quiz: c.quiz,
          balance: 0,
        }}
      />
    </div>
  );
}
