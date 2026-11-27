import type { Metadata } from "next";
import { HomeworkBoard } from "@/components/student/homework-board";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { homeworkFor } from "@/lib/domain/catalog";

export const metadata: Metadata = { title: "Homework" };

export default async function HomeworkPage({ searchParams }: PageProps<"/app/homework">) {
  const actor = await requireActor(["student"]);
  const sp = await searchParams;
  const items = homeworkFor(getDb(), actor, actor.id)
    .map((h) => ({
      id: h.id,
      title: h.title,
      description: h.description,
      due_at: h.due_at,
      subject_name: h.subject_name,
      subject_color: h.subject_color,
      teacher_name: h.teacher_name,
      submitted_at: h.submitted_at,
      feedback: h.feedback,
      body: h.body,
      file_name: h.file_name,
      state: h.state,
    }))
    .sort((a, b) => {
      const rank = { overdue: 0, due_soon: 1, open: 2, returned: 3, submitted: 4 } as const;
      return rank[a.state] - rank[b.state] || a.due_at.localeCompare(b.due_at);
    });
  return (
    <div>
      <PageHeader eyebrow="Catalog" title="Homework" description="Hand in assignments, attach your work and read feedback from your teachers. Each first submission earns 20 XP." />
      <HomeworkBoard items={items} initialOpen={typeof sp.open === "string" ? sp.open : null} />
    </div>
  );
}
