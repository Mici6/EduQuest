import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Scale, ShieldAlert } from "lucide-react";
import { RunDetectionButton } from "@/components/support/support-tools";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkTabs } from "@/components/ui/link-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { EmptyState, Notice } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { INDICATOR_LABEL, supportQueue } from "@/lib/domain/support";
import { relativeTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Support review queue" };

const STATUS = {
  pending_review: { tone: "ember", label: "Awaiting review" },
  confirmed: { tone: "iris", label: "Confirmed" },
  dismissed: { tone: "neutral", label: "Dismissed" },
  resolved: { tone: "mint", label: "Resolved" },
} as const;

export default async function SupportQueue({ searchParams }: PageProps<"/app/support">) {
  const actor = await requireActor(["support"]);
  const sp = await searchParams;
  const filter = typeof sp.status === "string" ? sp.status : "pending_review";
  const db = getDb();
  const all = supportQueue(db, actor);
  const hues = new Map(db.all<{ id: string; avatar_hue: number }>(`SELECT id, avatar_hue FROM users WHERE role = 'student'`).map((u) => [u.id, u.avatar_hue]));
  const items = filter === "all" ? all : all.filter((i) => i.status === filter);
  return (
    <div>
      <PageHeader eyebrow="Student support" title="Review queue" description="Patterns in academic data that may warrant a conversation. Every item needs a person to review it — nothing here is a diagnosis, label or prediction." actions={<RunDetectionButton />} />
      <Notice tone="ai" icon={<Scale />} title="Responsible use" className="mb-5">
        Indicators come from transparent rules (grade changes, missing work, attendance changes, reduced activity) over your caseload only. They never change a student's grades, XP, credits or access, and students cannot see them. Every view is audit-logged.
      </Notice>
      <div className="mb-5 grid grid-cols-2 gap-3 @3xl:grid-cols-4">
        <StatCard label="Awaiting review" value={all.filter((i) => i.status === "pending_review").length} accent="ember" icon={<ShieldAlert />} />
        <StatCard label="Confirmed" value={all.filter((i) => i.status === "confirmed").length} accent="iris" />
        <StatCard label="Dismissed" value={all.filter((i) => i.status === "dismissed").length} />
        <StatCard label="Resolved" value={all.filter((i) => i.status === "resolved").length} accent="mint" />
      </div>
      <LinkTabs
        label="Filter"
        className="mb-5"
        items={[
          { href: "/app/support", label: "Awaiting review", active: filter === "pending_review" },
          { href: "/app/support?status=confirmed", label: "Confirmed", active: filter === "confirmed" },
          { href: "/app/support?status=dismissed", label: "Dismissed", active: filter === "dismissed" },
          { href: "/app/support?status=resolved", label: "Resolved", active: filter === "resolved" },
          { href: "/app/support?status=all", label: "All", active: filter === "all" },
        ]}
      />
      {items.length ? (
        <ul className="grid gap-3 @3xl:grid-cols-2">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={`/app/support/indicators/${i.id}`} className="surface block rounded-[22px] p-4 transition-colors hover:border-line-strong">
                <div className="flex items-center gap-3">
                  <Avatar name={i.student_name} hue={hues.get(i.student_id) ?? 40} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{i.student_name}</p>
                    <p className="text-xs text-fg-3">{i.class_name}</p>
                  </div>
                  <Badge tone={STATUS[i.status as keyof typeof STATUS].tone}>{STATUS[i.status as keyof typeof STATUS].label}</Badge>
                </div>
                <p className="mt-3 text-sm font-semibold">{INDICATOR_LABEL[i.kind]}</p>
                <p className="mt-0.5 text-sm text-fg-2">{i.summary}</p>
                <p className="mt-2 text-xs text-fg-3">
                  Signal strength: <span className="font-semibold text-fg-2">{i.strength}</span> · detected {relativeTime(i.detected_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<ClipboardList />} title="Nothing in this list">
          When patterns appear in your caseload's academic data, they show up here for review.
        </EmptyState>
      )}
    </div>
  );
}
