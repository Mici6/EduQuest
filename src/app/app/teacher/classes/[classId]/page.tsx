import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { BarsChart } from "@/components/charts/charts";
import { AddGradeButton } from "@/components/teacher/grade-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardHeader } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/link-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { Notice } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { DomainError } from "@/lib/auth/errors";
import { getDb } from "@/lib/db";
import { classStats, teacherClasses } from "@/lib/domain/catalog";
import { cn, fmtGrade } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Class" };

export default async function ClassPage({ params, searchParams }: PageProps<"/app/teacher/classes/[classId]">) {
  const actor = await requireActor(["teacher"]);
  const { classId } = await params;
  const sp = await searchParams;
  const db = getDb();
  const pairs = teacherClasses(db, actor).filter((p) => p.class_id === classId);
  if (!pairs.length) notFound();
  const pair = pairs.find((p) => p.subject_id === sp.subject) ?? pairs[0]!;
  let stats;
  try {
    stats = classStats(db, actor, classId, pair.subject_id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const grades = db.all<{ student_id: string; value: number; title: string; graded_on: string }>(
    `SELECT student_id, value, title, graded_on FROM grades WHERE class_id = ? AND subject_id = ? ORDER BY graded_on DESC`,
    classId,
    pair.subject_id,
  );
  return (
    <div>
      <Link href="/app/teacher/classes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg">
        <ArrowLeft className="size-4" /> Classes
      </Link>
      <PageHeader eyebrow={pair.subject_name} title={pair.class_name} description={`${stats.students} students`} />
      {pairs.length > 1 ? (
        <LinkTabs label="Subject" className="mb-5" items={pairs.map((p) => ({ href: `/app/teacher/classes/${classId}?subject=${p.subject_id}`, label: p.subject_name, active: p.subject_id === pair.subject_id }))} />
      ) : null}
      <div className="mb-5 grid grid-cols-2 gap-3 @3xl:grid-cols-4">
        <StatCard label="Class average" value={fmtGrade(stats.average)} accent="sun" />
        <StatCard label="Attendance" value={`${stats.attendance ?? "—"}%`} accent="iris" />
        <StatCard label="Homework completion" value={`${stats.completion ?? "—"}%`} accent="mint" />
        <StatCard label="Grades recorded" value={grades.length} />
      </div>
      <div className="grid gap-5 @4xl:grid-cols-12">
        <Card className="@4xl:col-span-8">
          <CardHeader title="Roster" subtitle="Academic progress for this subject" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-fg-3">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2.5 pr-3 font-semibold">Student</th>
                  <th scope="col" className="py-2.5 pr-3 font-semibold">Recent grades</th>
                  <th scope="col" className="py-2.5 pr-3 text-right font-semibold">Average</th>
                  <th scope="col" className="py-2.5 pr-3 text-right font-semibold">Attendance</th>
                  <th scope="col" className="py-2.5 pr-3 text-right font-semibold">Homework</th>
                  <th scope="col" className="py-2.5 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.roster.map((r) => (
                  <tr key={r.id} className="border-b border-line/50 last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={r.display_name} hue={r.avatar_hue} size={30} />
                        <span className="font-medium">{r.display_name}</span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="flex gap-1">
                        {grades
                          .filter((g) => g.student_id === r.id)
                          .slice(0, 4)
                          .map((g, i) => (
                            <span key={i} title={`${g.title} · ${g.graded_on}`} className="inline-flex size-7 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold tabular-nums">
                              {g.value}
                            </span>
                          ))}
                      </span>
                    </td>
                    <td className={cn("py-2.5 pr-3 text-right font-display font-semibold tabular-nums", r.average != null && r.average < 5 && "text-amber")}>{fmtGrade(r.average)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-fg-2">{r.attendanceRate ?? "—"}%</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-fg-2">{r.completion ?? "—"}%</td>
                    <td className="py-2.5 text-right">
                      <AddGradeButton compact student={{ id: r.id, name: r.display_name }} classId={classId} subjectId={pair.subject_id} subjectName={`${pair.class_name} · ${pair.subject_name}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-5 @4xl:col-span-4">
          <Card>
            <BarsChart title="Grade distribution" description="Students by subject average" data={stats.distribution.map((d) => ({ label: d.band, students: d.count }))} xKey="label" series={[{ key: "students", name: "Students" }]} height={200} />
          </Card>
          <Notice tone="info" icon={<ShieldCheck />} title="Privacy by design">
            Teachers see academic data for the classes they teach. Student-support indicators and intervention notes are only visible to authorised support staff.
          </Notice>
        </div>
      </div>
    </div>
  );
}
