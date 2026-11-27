import type { Metadata } from "next";
import { Check, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { subscriptionInfo } from "@/lib/domain/admin";
import { fmtDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Plans & pricing" };

const AUDIENCE: Record<string, string> = { school: "B2B · schools", student_standard: "Students at non-participating schools", student_premium: "Optional student upgrade" };

export default async function PlansPage() {
  const actor = await requireActor(["admin"]);
  const { plans, current } = subscriptionInfo(getDb(), actor);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="School administration" title="Plans & pricing" description="EduQuest's business model is configured as data, not hard-coded. Prices are intentionally unset until the operator defines them." />
      {current ? (
        <Card tone="sun">
          <p className="text-sm font-semibold text-ink-950/70">This school's subscription</p>
          <p className="mt-1 font-display text-2xl font-semibold">{plans.find((p) => p.id === current.plan_id)?.name}</p>
          <p className="mt-1 text-sm text-ink-950/75">
            Status: <strong>{current.status === "demo" ? "Demo (no contract)" : current.status}</strong> · {current.seats} seats · since {fmtDate(current.starts_on, { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </Card>
      ) : null}
      <div className="grid gap-4 @4xl:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id} className="flex flex-col">
            <Badge tone={p.audience === "school" ? "sun" : p.audience === "student_standard" ? "mint" : "iris"}>{AUDIENCE[p.audience]}</Badge>
            <p className="mt-3 font-display text-xl font-semibold">{p.name}</p>
            <p className="mt-1 text-sm text-fg-2">{p.description}</p>
            <p className="mt-4 font-display text-2xl font-semibold">{p.price_minor != null ? `${(p.price_minor / 100).toFixed(2)} ${p.currency} / ${p.interval}` : <span className="text-base text-fg-3">Price not configured</span>}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-mint" aria-hidden /> {f}
                </li>
              ))}
            </ul>
            <p className="mt-auto pt-4 text-xs text-fg-3">AI allowance: {p.ai_daily_requests} requests per user per day</p>
          </Card>
        ))}
      </div>
      <Notice tone="info" icon={<Info />} title="Fairness commitments">
        Essential features stay free for students at participating schools. Premium never locks coursework, catalog access, volunteering or courses. Standard is priced to remain accessible for students whose schools don't participate.
      </Notice>
      <Card>
        <CardHeader title="How pricing is configured" />
        <p className="text-sm text-fg-2">
          Plans live in the <code className="rounded bg-white/10 px-1">subscription_plans</code> table (price in minor units, currency, interval, AI allowance and features). The platform operator sets them through a migration or an admin
          API — school administrators cannot change platform prices. Payment processing is not connected in this build.
        </p>
      </Card>
    </div>
  );
}
