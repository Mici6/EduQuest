import type { Metadata } from "next";
import Link from "next/link";
import { Award, BadgeCheck, Clock, Coins, FileSignature, HandCoins, Hourglass, Undo2, WandSparkles } from "lucide-react";
import { AiCourseRequest } from "@/components/courses/ai-course-request";
import { CourseIcon } from "@/components/courses/course-icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { IconChip } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { courseReviewers, grantBudget, grantEligibility, GRANT_RULES, myAiCourses } from "@/lib/domain/ai-courses";
import { coursesFor } from "@/lib/domain/courses";
import { creditBalance } from "@/lib/domain/credits";

export const metadata: Metadata = { title: "Courses" };

const STATUS = {
  pending_review: { label: "Waiting for review", tone: "sun", icon: <Hourglass /> },
  rejected: { label: "Sent back", tone: "rose", icon: <Undo2 /> },
  approved: { label: "In progress", tone: "iris", icon: <WandSparkles /> },
  completed: { label: "Awaiting accreditation", tone: "ember", icon: <Hourglass /> },
  accredited: { label: "Accredited", tone: "mint", icon: <FileSignature /> },
} as const;

export default async function CoursesPage() {
  const actor = await requireActor(["student"]);
  const db = getDb();
  const courses = coursesFor(db, actor);
  const done = courses.filter((c) => c.status === "completed").length;
  const mine = myAiCourses(db, actor);
  const budget = grantBudget(db, actor.schoolId);
  return (
    <div>
      <PageHeader
        eyebrow="Skills"
        title="Courses"
        description="Create a course on anything with AI, reviewed by one of your teachers, who accredits it with a letter of recommendation when you finish. Your school can fund it with a grant."
      />
      <div className="mb-8 grid gap-5 @4xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <AiCourseRequest reviewers={courseReviewers(db, actor.id)} grant={grantEligibility(db, actor.id, actor.schoolId)} currency={budget.currency} minJustification={GRANT_RULES.minJustification} />
        <Card>
          <CardHeader title="Your AI courses" subtitle="Reviewed by a teacher, accredited with a signed letter." />
          {mine.length ? (
            <ul className="divide-y divide-line/60">
              {mine.map((c) => {
                const st = STATUS[c.status];
                return (
                  <li key={c.id}>
                    <Link href={`/app/courses/ai/${c.id}`} className="-mx-2 flex flex-col gap-2 rounded-xl px-2 py-3 hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.title}</p>
                        <p className="text-xs text-fg-3">
                          Reviewer: {c.reviewer} · {c.lessonsDone}/{c.lessons} lessons{c.bestScore != null ? ` · best ${c.bestScore}%` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        {c.grantStatus === "approved" || c.grantStatus === "released" ? (
                          <Badge tone="mint" icon={<HandCoins />}>
                            {c.grantApproved} {budget.currency} {c.grantStatus === "released" ? "paid" : "reserved"}
                          </Badge>
                        ) : null}
                        <Badge tone={st.tone} icon={st.icon}>
                          {st.label}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={<WandSparkles />} title="No AI courses yet">
              Try “First aid” or “Debate”.
            </EmptyState>
          )}
        </Card>
      </div>
      <h2 className="mb-1 font-display text-xl font-semibold">Ready-made mini-courses</h2>
      <p className="mb-4 text-sm text-fg-2">Unlock with the credits you earn volunteering. Pass the quiz for a certificate in your Skills Passport.</p>
      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard label="Your credits" value={creditBalance(db, actor.id)} accent="sun" icon={<Coins />} />
        <StatCard label="Courses completed" value={`${done} / ${courses.length}`} accent="mint" icon={<BadgeCheck />} />
        <StatCard label="Certificates in your passport" value={done} accent="iris" icon={<Award />} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((c) => (
          <Link key={c.id} href={`/app/courses/${c.id}`} className="surface group flex flex-col rounded-[var(--radius-card)] p-5 transition-colors hover:border-line-strong">
            <div className="flex items-start justify-between gap-3">
              <IconChip tone={c.status === "completed" ? "mint" : c.status === "unlocked" ? "iris" : "sun"} className="size-11 [&_svg]:size-5">
                <CourseIcon icon={c.icon} />
              </IconChip>
              {c.status === "completed" ? (
                <Badge tone="mint" icon={<BadgeCheck />}>
                  Certified · {c.bestScore}%
                </Badge>
              ) : c.status === "unlocked" ? (
                <Badge tone="iris">In progress</Badge>
              ) : (
                <Badge tone="sun" icon={<Coins />}>
                  {c.creditCost} credits
                </Badge>
              )}
            </div>
            <h2 className="mt-4 font-display text-lg font-semibold group-hover:text-sun-200">{c.title}</h2>
            <p className="mt-1 flex-1 text-sm text-fg-2">{c.summary}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {c.skills.map((s) => (
                <Badge key={s}>{s}</Badge>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3 text-xs text-fg-3">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden /> ~{c.minutes} min
              </span>
              <span>{c.lessons} lessons + quiz</span>
            </div>
            {c.status === "unlocked" ? <ProgressBar value={c.lessonsDone / c.lessons} tone="iris" size="sm" className="mt-3" label="Lessons completed" /> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
