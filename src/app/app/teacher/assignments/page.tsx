import type { Metadata } from "next";
import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { NewAssignmentButton } from "@/components/teacher/assignment-tools";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { teacherAssignments, teacherClasses } from "@/lib/domain/catalog";
import { toDate } from "@/lib/utils/dates";
import { fmtDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Assignments" };

export default async function AssignmentsPage() {
  const actor = await requireActor(["teacher"]);
  const db = getDb();
  const rows = teacherAssignments(db, actor);
  const pairs = teacherClasses(db, actor).map((p) => ({ class_id: p.class_id, class_name: p.class_name, subject_id: p.subject_id, subject_name: p.subject_name }));
  const now = new Date().getTime();
  return (
    <div>
      <PageHeader eyebrow="Teaching" title="Assignments" description="Publish homework, follow submissions and return feedback." actions={<NewAssignmentButton pairs={pairs} />} />
      {rows.length ? (
        <ul className="space-y-2.5">
          {rows.map((a) => {
            const past = toDate(a.due_at).getTime() < now;
            return (
              <li key={a.id}>
                <Link href={`/app/teacher/assignments/${a.id}`} className="surface flex flex-col gap-3 rounded-[22px] p-4 transition-colors hover:border-line-strong @2xl:flex-row @2xl:items-center">
                  <span className="hidden h-10 w-1 shrink-0 rounded-full @2xl:block" style={{ background: a.subject_color }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{a.title}</p>
                    <p className="text-xs text-fg-3">
                      {a.class_name} · {a.subject_name} · due {fmtDateTime(a.due_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 @2xl:w-72">
                    <ProgressBar value={a.students ? a.submitted / a.students : 0} size="sm" tone={past ? "ember" : "sun"} label="Submissions" />
                    <span className="shrink-0 text-xs tabular-nums text-fg-2">
                      {a.submitted}/{a.students}
                    </span>
                    {a.origin === "ai_reviewed" ? <Badge tone="iris">AI-assisted</Badge> : null}
                    <Badge tone={past ? "neutral" : "sun"}>{past ? "Closed" : "Open"}</Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<NotebookPen />} title="No assignments yet" />
      )}
    </div>
  );
}
