import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Lock } from "lucide-react";
import { TrendChart } from "@/components/charts/charts";
import { NoteComposer, PlanStatusSelect } from "@/components/support/support-tools";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { DomainError } from "@/lib/auth/errors";
import { getDb } from "@/lib/db";
import { planDetail } from "@/lib/domain/support";
import { fmtDate, fmtGrade, relativeTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Support plan" };

const KIND: Record<string, string> = { note: "Note", follow_up: "Follow-up", progress_review: "Progress review" };

export default async function PlanPage({ params }: PageProps<"/app/support/plans/[id]">) {
  const actor = await requireActor(["support"]);
  const { id } = await params;
  let d;
  try {
    d = planDetail(getDb(), actor, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const delta = (a: number | null, b: number | null, suffix = "") => (a == null || b == null ? "—" : `${b - a >= 0 ? "+" : ""}${Math.round((b - a) * 10) / 10}${suffix}`);
  return (
    <div>
      <Link href="/app/support/plans" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg">
        <ArrowLeft className="size-4" /> Support plans
      </Link>
      <PageHeader
        eyebrow="Support plan"
        title={
          <span className="inline-flex items-center gap-3">
            <Avatar name={d.student.display_name} hue={d.student.avatar_hue} size={40} /> {d.student.display_name}
          </span>
        }
        description={`Owner ${d.plan.owner_name} · created ${fmtDate(d.plan.created_at, { day: "numeric", month: "long" })}`}
        actions={<PlanStatusSelect planId={d.plan.id} status={d.plan.status} />}
      />
      <div className="grid gap-5 @4xl:grid-cols-12">
        <div className="space-y-5 @4xl:col-span-7">
          <Card>
            <CardHeader title="Goals" />
            <p className="whitespace-pre-line text-sm text-fg-2">{d.plan.goals}</p>
            <CardHeader title="Supportive actions" className="mb-2 mt-5" />
            <p className="whitespace-pre-line text-sm text-fg-2">{d.plan.actions}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <Badge tone="iris" icon={<CalendarClock />}>
                Review on {fmtDate(d.plan.review_on, { day: "numeric", month: "long" })}
              </Badge>
              <Badge icon={<Lock />}>Retained until {fmtDate(d.plan.retain_until, { day: "numeric", month: "short", year: "numeric" })}</Badge>
            </div>
          </Card>
          <Card>
            <CardHeader title="Progress since the plan started" subtitle={`Comparing ${d.progress.windowDays} days before and after`} />
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/[0.04] p-4">
                <p className="text-xs text-fg-3">Average grade</p>
                <p className="mt-1 font-display text-lg font-semibold tabular-nums">
                  {fmtGrade(d.progress.grades.before)} → {fmtGrade(d.progress.grades.after)}
                </p>
                <p className="text-xs text-fg-2">{delta(d.progress.grades.before, d.progress.grades.after)}</p>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-4">
                <p className="text-xs text-fg-3">Attendance</p>
                <p className="mt-1 font-display text-lg font-semibold tabular-nums">
                  {d.progress.attendance.before ?? "—"}% → {d.progress.attendance.after ?? "—"}%
                </p>
                <p className="text-xs text-fg-2">{delta(d.progress.attendance.before, d.progress.attendance.after, " pts")}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-5 @2xl:grid-cols-2">
              <TrendChart title="Weekly average grade" data={d.snapshot.weeks.map((w) => ({ label: w.label, value: w.average }))} domain={[1, 10]} name="Average" height={160} />
              <TrendChart title="Weekly attendance" data={d.snapshot.weeks.map((w) => ({ label: w.label, value: w.attendance }))} domain={[0, 100]} name="Attendance" suffix="%" height={160} />
            </div>
          </Card>
        </div>
        <div className="space-y-5 @4xl:col-span-5">
          <Card>
            <CardHeader title="Add to timeline" />
            <NoteComposer planId={d.plan.id} />
          </Card>
          <Card>
            <CardHeader title="Timeline" />
            <ol className="relative space-y-4 border-l border-line pl-5">
              {d.notes.map((n) => (
                <li key={n.id} className="relative">
                  <span className="absolute -left-[26px] top-1 size-3 rounded-full bg-iris-400 ring-4 ring-ink-800" aria-hidden />
                  <p className="flex flex-wrap items-center gap-2 text-xs text-fg-3">
                    <Badge tone={n.kind === "progress_review" ? "mint" : n.kind === "follow_up" ? "iris" : "neutral"}>{KIND[n.kind]}</Badge>
                    {n.author_name} · {relativeTime(n.created_at)}
                  </p>
                  <p className="mt-1.5 text-sm text-fg-2">{n.body}</p>
                </li>
              ))}
              {!d.notes.length ? <li className="text-sm text-fg-3">No notes yet.</li> : null}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
