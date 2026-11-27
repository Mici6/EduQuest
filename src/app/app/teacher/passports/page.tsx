import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Clock, FileSignature, Hourglass } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { homeroomStudents } from "@/lib/domain/passport";

export const metadata: Metadata = { title: "Passports & letters" };

export default async function TeacherPassportsPage() {
  const actor = await requireActor(["teacher"]);
  const students = homeroomStudents(getDb(), actor);
  return (
    <div>
      <PageHeader
        eyebrow="Homeroom"
        title="Passports & recommendation letters"
        description="Review your homeroom students' Skills Passports, verify their projects, and sign recommendation letters drafted from their activity in EduQuest (available after one year)."
      />
      {students.length ? (
        <Card className="!p-0">
          <ul className="divide-y divide-line">
            {students.map((s) => (
              <li key={s.id}>
                <Link href={`/app/teacher/passports/${s.id}`} className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.display_name} hue={s.avatar_hue} />
                    <div>
                      <p className="font-medium">{s.display_name}</p>
                      <p className="text-xs text-fg-3">{s.class_name}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="mint" icon={<Clock />}>
                      {s.verifiedHours} h volunteering
                    </Badge>
                    {s.pendingProjects ? (
                      <Badge tone="ember" icon={<BadgeCheck />}>
                        {s.pendingProjects} project{s.pendingProjects > 1 ? "s" : ""} to verify
                      </Badge>
                    ) : null}
                    {s.letters ? (
                      <Badge tone="iris" icon={<FileSignature />}>
                        {s.letters} letter{s.letters > 1 ? "s" : ""}
                      </Badge>
                    ) : s.eligible ? (
                      <Badge tone="sun" icon={<FileSignature />}>
                        Letter available
                      </Badge>
                    ) : (
                      <Badge icon={<Hourglass />}>Letter in {s.daysLeft} days</Badge>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState icon={<FileSignature />} title="You're not a homeroom teacher">
          Recommendation letters are written by a student&apos;s homeroom teacher.
        </EmptyState>
      )}
    </div>
  );
}
