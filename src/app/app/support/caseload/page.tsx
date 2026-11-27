import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { caseload } from "@/lib/domain/support";

export const metadata: Metadata = { title: "Caseload" };

export default async function CaseloadPage() {
  const actor = await requireActor(["support"]);
  const rows = caseload(getDb(), actor);
  return (
    <div>
      <PageHeader eyebrow="Student support" title="Caseload" description="Students you're authorised to support. Assignment to a caseload is managed by the school." />
      <Card className="!p-0">
        <ul className="divide-y divide-line/60">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <Avatar name={r.display_name} hue={r.avatar_hue} size={36} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{r.display_name}</p>
                <p className="text-xs text-fg-3">{r.class_name}</p>
              </div>
              {r.open_indicators ? (
                <Link href={`/app/support`}>
                  <Badge tone="ember">{r.open_indicators} to review</Badge>
                </Link>
              ) : null}
              {r.active_plans ? <Badge tone="iris">{r.active_plans} active plan</Badge> : null}
              {!r.open_indicators && !r.active_plans ? <span className="text-xs text-fg-3">No open items</span> : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
