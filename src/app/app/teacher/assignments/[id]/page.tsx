import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ReturnSubmissionButton } from "@/components/teacher/assignment-tools";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { DomainError } from "@/lib/auth/errors";
import { getDb } from "@/lib/db";
import { assignmentSubmissions } from "@/lib/domain/catalog";
import { relativeTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Submissions" };

export default async function SubmissionsPage({ params }: PageProps<"/app/teacher/assignments/[id]">) {
  const actor = await requireActor(["teacher"]);
  const { id } = await params;
  const db = getDb();
  let data;
  try {
    data = assignmentSubmissions(db, actor, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const hues = new Map(db.all<{ id: string; avatar_hue: number }>(`SELECT id, avatar_hue FROM users WHERE role = 'student'`).map((u) => [u.id, u.avatar_hue]));
  const submitted = data.rows.filter((r) => r.submission_id).length;
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/app/teacher/assignments" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg">
        <ArrowLeft className="size-4" /> Assignments
      </Link>
      <PageHeader eyebrow="Submissions" title={data.title} description={`${submitted} of ${data.rows.length} students have submitted`} />
      <Card>
        <ul className="divide-y divide-line/60">
          {data.rows.map((r) => (
            <li key={r.student_id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar name={r.display_name} hue={hues.get(r.student_id) ?? 40} size={34} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.display_name}</p>
                <p className="text-xs text-fg-3">{r.submitted_at ? `Submitted ${relativeTime(r.submitted_at)}${r.file_name ? ` · ${r.file_name}` : ""}` : "Not submitted"}</p>
              </div>
              {r.status === "returned" ? (
                <Badge tone="mint">Feedback returned</Badge>
              ) : r.submission_id ? (
                <ReturnSubmissionButton submissionId={r.submission_id} studentName={r.display_name} body={r.body} fileName={r.file_name} />
              ) : (
                <Badge>Missing</Badge>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
