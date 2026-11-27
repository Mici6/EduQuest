import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { TrendChart } from "@/components/charts/charts";
import { CreatePlanButton, ReviewForm } from "@/components/support/support-tools";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { DomainError } from "@/lib/auth/errors";
import { getDb } from "@/lib/db";
import { INDICATOR_LABEL, indicatorDetail } from "@/lib/domain/support";
import { fmtDate, relativeTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Indicator review" };

export default async function IndicatorPage({ params }: PageProps<"/app/support/indicators/[id]">) {
  const actor = await requireActor(["support"]);
  const { id } = await params;
  let d;
  try {
    d = indicatorDetail(getDb(), actor, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const ind = d.indicator;
  return (
    <div>
      <Link href="/app/support" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg">
        <ArrowLeft className="size-4" /> Review queue
      </Link>
      <PageHeader
        eyebrow="Indicator review"
        title={INDICATOR_LABEL[ind.kind]}
        description={
          <span className="inline-flex items-center gap-2">
            <Avatar name={d.student.display_name} hue={d.student.avatar_hue} size={22} /> {d.student.display_name} · detected {relativeTime(ind.detected_at)}
          </span>
        }
        actions={<Badge tone={ind.status === "pending_review" ? "ember" : ind.status === "confirmed" ? "iris" : "neutral"}>{ind.status.replace("_", " ")}</Badge>}
      />
      <div className="grid gap-5 @4xl:grid-cols-12">
        <div className="space-y-5 @4xl:col-span-7">
          <Card>
            <CardHeader title="What was detected" subtitle={`Rule set ${ind.detector} · signal strength: ${ind.strength}`} />
            <p className="text-sm">{ind.summary}</p>
            <table className="mt-4 w-full text-left text-sm">
              <thead className="text-xs text-fg-3">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 font-semibold">Evidence</th>
                  <th scope="col" className="py-2 text-right font-semibold">Before</th>
                  <th scope="col" className="py-2 text-right font-semibold">Recent</th>
                </tr>
              </thead>
              <tbody>
                {ind.evidence.map((e, i) => (
                  <tr key={i} className="border-b border-line/50 last:border-0">
                    <td className="py-2">{e.label}</td>
                    <td className="py-2 text-right tabular-nums text-fg-2">{e.before ?? "—"}</td>
                    <td className="py-2 text-right tabular-nums">{e.after ?? e.value ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Notice tone="info" icon={<Info />} className="mt-4">
              Patterns have many possible explanations (illness, family events, a hard topic). Talk with the student and relevant staff before drawing conclusions.
            </Notice>
          </Card>
          <div className="grid gap-5 @2xl:grid-cols-2">
            <Card>
              <TrendChart title="Weekly average grade" description="Last 8 weeks" data={d.snapshot.weeks.map((w) => ({ label: w.label, value: w.average }))} domain={[1, 10]} name="Average" height={180} />
            </Card>
            <Card>
              <TrendChart title="Weekly attendance" description="Last 8 weeks" data={d.snapshot.weeks.map((w) => ({ label: w.label, value: w.attendance }))} domain={[0, 100]} name="Attendance" suffix="%" height={180} />
            </Card>
          </div>
        </div>
        <div className="space-y-5 @4xl:col-span-5">
          {ind.status === "pending_review" ? (
            <Card>
              <CardHeader title="Your review" subtitle="Confirm if follow-up support may help, or dismiss with a reason." />
              <ReviewForm indicatorId={ind.id} />
            </Card>
          ) : null}
          {ind.status === "confirmed" && !d.plans.length ? (
            <Card tone="outline">
              <CardHeader title="Next step" subtitle="Agree a supportive plan and set a review date." />
              <CreatePlanButton studentId={d.student.id} indicatorId={ind.id} studentName={d.student.display_name} />
            </Card>
          ) : null}
          {d.reviews.length ? (
            <Card>
              <CardHeader title="Review history" />
              <ul className="space-y-3">
                {d.reviews.map((r) => (
                  <li key={r.id} className="rounded-2xl border border-line bg-ink-900/60 p-3 text-sm">
                    <p className="flex items-center justify-between gap-2 text-xs text-fg-3">
                      <span>{r.reviewer_name}</span>
                      <span>{fmtDate(r.created_at)}</span>
                    </p>
                    <Badge tone={r.decision === "confirmed" ? "iris" : "neutral"} className="mt-1.5">
                      {r.decision}
                    </Badge>
                    <p className="mt-1.5 text-fg-2">{r.rationale}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {d.plans.length ? (
            <Card>
              <CardHeader title="Support plan" />
              {d.plans.map((p) => (
                <Link key={p.id} href={`/app/support/plans/${p.id}`} className="block rounded-2xl border border-line bg-ink-900/60 p-3 text-sm hover:border-line-strong">
                  <Badge tone="iris">{p.status}</Badge>
                  <p className="mt-1.5 line-clamp-2 text-fg-2">{p.goals}</p>
                  <p className="mt-1 text-xs text-fg-3">Review on {fmtDate(p.review_on)}</p>
                </Link>
              ))}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
