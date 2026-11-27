import type { Metadata } from "next";
import Link from "next/link";
import { FileSignature, HandCoins, Hourglass, Undo2, WandSparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { grantBudget, reviewQueue } from "@/lib/domain/ai-courses";

export const metadata: Metadata = { title: "Course reviews" };

const STATUS = {
  pending_review: { label: "Needs review", tone: "sun", icon: <Hourglass /> },
  completed: { label: "Ready to accredit", tone: "ember", icon: <FileSignature /> },
  approved: { label: "Student studying", tone: "iris", icon: <WandSparkles /> },
  accredited: { label: "Accredited", tone: "mint", icon: <FileSignature /> },
  rejected: { label: "Sent back", tone: "neutral", icon: <Undo2 /> },
} as const;

export default async function TeacherCoursesPage() {
  const actor = await requireActor(["teacher"]);
  const db = getDb();
  const queue = reviewQueue(db, actor);
  const budget = grantBudget(db, actor.schoolId);
  return (
    <div>
      <PageHeader
        eyebrow="AI courses"
        title="Course reviews"
        description={`Students create courses with AI and choose you as reviewer. Check the content and any grant request, then accredit finished courses with a letter of recommendation. ${budget.remaining} ${budget.currency} left in the school's grant budget.`}
      />
      {queue.length ? (
        <Card className="!p-0">
          <ul className="divide-y divide-line">
            {queue.map((c) => {
              const st = STATUS[c.status];
              return (
                <li key={c.id}>
                  <Link href={`/app/teacher/courses/${c.id}`} className="flex flex-col gap-2 px-4 py-4 transition-colors hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={c.student} hue={c.avatar_hue} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.title}</p>
                        <p className="text-xs text-fg-3">
                          {c.student} · asked for “{c.topic}”{c.best_score != null ? ` · best ${c.best_score}%` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      {c.grant_requested ? (
                        <Badge tone={c.grant_status === "approved" || c.grant_status === "released" ? "mint" : c.grant_status === "declined" ? "neutral" : "sun"} icon={<HandCoins />}>
                          {
                            {
                              none: "",
                              requested: `${c.grant_requested} ${budget.currency} requested`,
                              recommended: "Grant with administration",
                              declined: "Grant declined",
                              approved: `${c.grant_approved} ${budget.currency} reserved`,
                              released: `${c.grant_approved} ${budget.currency} paid`,
                            }[c.grant_status]
                          }
                        </Badge>
                      ) : null}
                      <Badge tone={st.tone} icon={st.icon}>
                        {st.label}
                      </Badge>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <EmptyState icon={<WandSparkles />} title="Nothing to review">
          When a student picks you as reviewer for an AI course, it shows up here.
        </EmptyState>
      )}
    </div>
  );
}
