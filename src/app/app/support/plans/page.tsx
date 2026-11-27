import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { plansFor } from "@/lib/domain/support";
import { fmtDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Support plans" };

export default async function PlansPage() {
  const actor = await requireActor(["support"]);
  const plans = plansFor(getDb(), actor);
  return (
    <div>
      <PageHeader eyebrow="Student support" title="Support plans" description="Agreed goals, supportive actions and follow-up notes." />
      {plans.length ? (
        <ul className="grid gap-3 @3xl:grid-cols-2">
          {plans.map((p) => (
            <li key={p.id}>
              <Link href={`/app/support/plans/${p.id}`} className="surface block rounded-[22px] p-4 hover:border-line-strong">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{p.student_name}</p>
                  <Badge tone={p.status === "closed" ? "neutral" : p.status === "monitoring" ? "mint" : "iris"}>{p.status}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-fg-2">{p.goals}</p>
                <p className="mt-2 text-xs text-fg-3">
                  Review {fmtDate(p.review_on)} · {p.notes} notes
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<BookOpen />} title="No support plans yet" />
      )}
    </div>
  );
}
