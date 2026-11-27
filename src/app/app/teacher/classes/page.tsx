import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { classStats, teacherClasses } from "@/lib/domain/catalog";
import { fmtGrade } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Classes" };

export default async function TeacherClassesPage() {
  const actor = await requireActor(["teacher"]);
  const db = getDb();
  const pairs = teacherClasses(db, actor).map((p) => ({ ...p, stats: classStats(db, actor, p.class_id, p.subject_id) }));
  return (
    <div>
      <PageHeader eyebrow="Teaching" title="Classes & grades" description="Open a class to see the roster, enter grades and track progress." />
      <ul className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
        {pairs.map((p) => (
          <li key={p.class_id + p.subject_id}>
            <Link href={`/app/teacher/classes/${p.class_id}?subject=${p.subject_id}`} className="surface group block rounded-[var(--radius-card)] p-5 transition-all hover:-translate-y-0.5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-2xl font-semibold">{p.class_name}</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-fg-2">
                    <span className="size-2 rounded-full" style={{ background: p.subject_color }} aria-hidden /> {p.subject_name} · {p.students} students
                  </p>
                </div>
                <ArrowUpRight className="size-5 text-fg-3 group-hover:text-fg" aria-hidden />
              </div>
              <div className="mt-5 space-y-3 text-xs">
                <div>
                  <div className="mb-1 flex justify-between text-fg-2">
                    <span>Class average</span>
                    <span className="font-semibold text-fg">{fmtGrade(p.stats.average)}</span>
                  </div>
                  <ProgressBar value={(p.stats.average ?? 0) / 10} size="sm" />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-fg-2">
                    <span>Attendance</span>
                    <span className="font-semibold text-fg">{p.stats.attendance ?? "—"}%</span>
                  </div>
                  <ProgressBar value={(p.stats.attendance ?? 0) / 100} size="sm" tone="iris" />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-fg-2">
                    <span>Homework completion</span>
                    <span className="font-semibold text-fg">{p.stats.completion ?? "—"}%</span>
                  </div>
                  <ProgressBar value={(p.stats.completion ?? 0) / 100} size="sm" tone="mint" />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
