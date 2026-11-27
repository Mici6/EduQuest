import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { ROLE_LABEL, type Role } from "@/lib/auth/types";
import { getDb } from "@/lib/db";
import { auditLog } from "@/lib/domain/admin";
import { fmtDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage() {
  const actor = await requireActor(["admin"]);
  const rows = auditLog(getDb(), actor, 150);
  return (
    <div>
      <PageHeader eyebrow="School administration" title="Audit log" description="Sensitive operations are recorded with who, what and when — never the contents of records. Support-record reads are logged too." />
      {rows.length ? (
        <Card className="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-fg-3">
                <tr className="border-b border-line">
                  <th scope="col" className="px-5 py-3 font-semibold">When</th>
                  <th scope="col" className="py-3 font-semibold">Who</th>
                  <th scope="col" className="py-3 font-semibold">Action</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Resource</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line/50 last:border-0">
                    <td className="whitespace-nowrap px-5 py-2.5 tabular-nums text-fg-2">{fmtDateTime(r.created_at)}</td>
                    <td className="py-2.5">
                      {r.actor_name ?? "System"}
                      {r.actor_role ? <span className="block text-[11px] text-fg-3">{ROLE_LABEL[r.actor_role as Role]}</span> : null}
                    </td>
                    <td className="py-2.5">
                      <Badge tone={r.action.startsWith("support.") ? "iris" : r.action.startsWith("rewards.") || r.action.startsWith("volunteering.") ? "ember" : "neutral"}>{r.action}</Badge>
                    </td>
                    <td className="px-5 py-2.5 font-mono text-[11px] text-fg-3">
                      {r.resource_type}
                      {r.resource_id ? `:${r.resource_id.slice(0, 14)}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState icon={<ScrollText />} title="No audited actions yet" />
      )}
    </div>
  );
}
