import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { SchoolSettingsForm } from "@/components/admin/school-settings-form";
import { ResetDemoButton } from "@/components/auth/reset-demo-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { PERMISSIONS } from "@/lib/auth/policy";
import { ROLES, ROLE_LABEL } from "@/lib/auth/types";
import { config, publicConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { schoolSettings } from "@/lib/domain/admin";

export const metadata: Metadata = { title: "School settings" };

export default async function SchoolSettingsPage() {
  const actor = await requireActor(["admin"]);
  const cfg = publicConfig();
  const integrations = [
    { name: "Authentication", status: cfg.mode === "production" ? "Supabase Auth" : "Demo sign-in (no passwords)", ok: cfg.mode === "production" },
    { name: "Database", status: cfg.mode === "production" ? "PostgreSQL (Supabase)" : "Local SQLite (demo)", ok: true },
    { name: "AI provider", status: cfg.aiMode === "cloud" ? `Cloud · ${cfg.aiModel}` : cfg.aiMode === "browser" ? `On-device · ${cfg.aiModel} (simulation on unsupported devices)` : cfg.aiMode === "simulated" ? "Simulation only" : "Not configured", ok: cfg.aiMode === "cloud" || cfg.aiMode === "browser" },
    { name: "OCR for images & scans", status: "Unavailable", ok: false },
    { name: "Vector embeddings", status: "Not configured — lexical BM25 search in use", ok: false },
    { name: "File storage", status: cfg.mode === "production" ? "Supabase Storage (private bucket)" : "Local disk (demo)", ok: true },
    { name: "Payments", status: "Not connected", ok: false },
    { name: "Email / push notifications", status: "Not connected — in-app only", ok: false },
  ];
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="School administration" title="School settings" description="Policies for AI, gamification, uploads and data retention. Every change is audit-logged." />
      <div className="grid gap-5 @4xl:grid-cols-12">
        <Card className="@4xl:col-span-7">
          <CardHeader title="Policies" />
          <SchoolSettingsForm initial={schoolSettings(getDb(), actor.schoolId)} />
        </Card>
        <Card className="@4xl:col-span-5">
          <CardHeader title="Integrations" subtitle="Read from server configuration. Secrets are never shown." />
          <ul className="space-y-2.5">
            {integrations.map((i) => (
              <li key={i.name} className="flex items-start justify-between gap-3 text-sm">
                <span className="font-medium">{i.name}</span>
                <span className="text-right">
                  <Badge tone={i.ok ? "mint" : "neutral"}>{i.status}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card>
        <CardHeader title="Role permissions" subtitle="Enforced on the server for every action, plus scope checks (own record, taught classes, support caseload)." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-fg-3">
              <tr className="border-b border-line">
                <th scope="col" className="py-2.5 font-semibold">Permission</th>
                {ROLES.map((r) => (
                  <th key={r} scope="col" className="py-2.5 text-center font-semibold">
                    {ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(PERMISSIONS).map(([perm, roles]) => (
                <tr key={perm} className="border-b border-line/40 last:border-0">
                  <td className="py-2 font-mono text-xs text-fg-2">{perm}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="py-2 text-center">
                      {(roles as readonly string[]).includes(r) ? <Check className="mx-auto size-4 text-mint" aria-label="Allowed" /> : <Minus className="mx-auto size-4 text-fg-3/50" aria-label="Not allowed" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {cfg.mode === "demo" ? (
        <Card tone="outline">
          <CardHeader title="Demo data" subtitle="Regenerate the sample school with current dates. Signs everyone out." action={config.demoResetAllowed ? <ResetDemoButton variant="danger" /> : undefined} />
        </Card>
      ) : null}
    </div>
  );
}
