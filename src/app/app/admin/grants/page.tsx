import type { Metadata } from "next";
import { HandCoins, PiggyBank, ShieldCheck, Wallet } from "lucide-react";
import { GrantBudgetForm } from "@/components/admin/grant-budget-form";
import { GrantDecision } from "@/components/admin/grant-decision";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { GRANT_RULES, grantsOverview, type GrantStatus } from "@/lib/domain/ai-courses";
import { fmtDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Grants" };

const STATUS: Record<Exclude<GrantStatus, "none">, { label: string; tone: "sun" | "iris" | "mint" | "neutral" | "rose" }> = {
  recommended: { label: "Needs your decision", tone: "iris" },
  requested: { label: "With the teacher", tone: "sun" },
  approved: { label: "Reserved", tone: "mint" },
  released: { label: "Paid out", tone: "mint" },
  declined: { label: "Declined", tone: "neutral" },
};

export default async function AdminGrantsPage() {
  const actor = await requireActor(["admin"]);
  const g = grantsOverview(getDb(), actor);
  const waiting = g.grants.filter((x) => x.grant_status === "recommended").length;
  return (
    <div>
      <PageHeader
        eyebrow="School administration"
        title="Course grants"
        description="Grants are hard to get on purpose. Students must qualify to ask, the reviewing teacher recommends, you make the final decision, and the money is only paid out once the course is accredited."
      />
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard label="Budget" value={`${g.budget} ${g.currency}`} accent="sun" icon={<Wallet />} />
        <StatCard label="Reserved & paid" value={`${g.committed} ${g.currency}`} accent="iris" icon={<HandCoins />} />
        <StatCard label="Left" value={`${g.remaining} ${g.currency}`} accent="mint" icon={<PiggyBank />} />
      </div>
      <div className="mb-5 grid gap-5 @4xl:grid-cols-2">
        <Card>
          <CardHeader title="Grant budget" subtitle="Lowering it below what's already approved stops new grants but keeps existing ones." />
          <GrantBudgetForm budget={g.budget} currency={g.currency} />
        </Card>
        <Card>
          <CardHeader title="Rules" icon={<ShieldCheck className="size-5 text-mint" />} subtitle="Checked on the server; students see which ones they don't meet yet." />
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-fg-2">
            <li>At least {GRANT_RULES.minAccreditedCourses} AI course already accredited by a teacher.</li>
            <li>At least {GRANT_RULES.minVolunteeringHours} hours of verified volunteering.</li>
            <li>One grant per student per {GRANT_RULES.cooldownDays} days, and one open request at a time.</li>
            <li>
              At most {g.maxGrant} {g.currency} per grant ({GRANT_RULES.maxAmount} {g.currency} or {GRANT_RULES.maxBudgetShare * 100}% of the budget, whichever is lower).
            </li>
            <li>A written justification of at least {GRANT_RULES.minJustification} characters.</li>
            <li>Teacher recommends, administration decides, paid out only after accreditation.</li>
          </ul>
        </Card>
      </div>
      <Card>
        <CardHeader title="Grants" subtitle={waiting ? `${waiting} waiting for your decision.` : "Nothing waiting for your decision."} />
        {g.grants.length ? (
          <ul className="divide-y divide-line/60">
            {g.grants.map((x) => {
              const st = STATUS[x.grant_status as Exclude<GrantStatus, "none">];
              const amount = x.grant_status === "approved" || x.grant_status === "released" ? x.grant_approved : x.grant_status === "recommended" ? x.grant_recommended : x.grant_requested;
              return (
                <li key={x.id} className="py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {x.student} · {x.title}
                      </p>
                      <p className="text-xs text-fg-3">
                        Reviewer {x.reviewer} · requested {x.grant_requested} {g.currency}
                        {x.grant_status === "recommended" ? ` · teacher recommends ${x.grant_recommended} ${g.currency}` : ""}
                        {x.grant_decided_at ? ` · decided ${fmtDate(x.grant_decided_at)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      <Badge tone="neutral" icon={<HandCoins />}>
                        {amount} {g.currency}
                      </Badge>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                  </div>
                  {x.grant_purpose ? <p className="mt-2 max-w-[65ch] text-sm text-fg-2">{x.grant_purpose}</p> : null}
                  {x.grant_note ? <p className="mt-1 text-xs text-fg-3">Note: {x.grant_note}</p> : null}
                  {x.grant_status === "recommended" ? <GrantDecision id={x.id} recommended={x.grant_recommended} max={g.maxGrant} currency={g.currency} /> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<HandCoins />} title="No grants yet">
            Requests appear here once a student who qualifies asks for one.
          </EmptyState>
        )}
      </Card>
    </div>
  );
}
