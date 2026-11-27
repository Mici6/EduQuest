import type { Metadata } from "next";
import { AssignTeacherButton, NewClassButton, NewSubjectButton } from "@/components/admin/classes-tools";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { allClasses, allTeachers, teachingMatrix } from "@/lib/domain/admin";
import { subjectsForSchool } from "@/lib/domain/catalog";

export const metadata: Metadata = { title: "Classes & subjects" };

export default async function ClassesAdmin() {
  const actor = await requireActor(["admin"]);
  const db = getDb();
  const classes = allClasses(db, actor.schoolId);
  const subjects = subjectsForSchool(db, actor.schoolId);
  const teachers = allTeachers(db, actor.schoolId);
  const matrix = teachingMatrix(db, actor);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="School administration" title="Classes & subjects" description="Structure of the school year and who teaches what." />
      <div className="grid gap-5 @4xl:grid-cols-2">
        <Card>
          <CardHeader title={`Classes (${classes.length})`} action={<NewClassButton teachers={teachers} />} />
          <ul className="grid grid-cols-2 gap-2 @2xl:grid-cols-3">
            {classes.map((c) => (
              <li key={c.id} className="rounded-2xl border border-line bg-ink-900/60 p-3">
                <p className="font-display font-semibold">{c.name}</p>
                <p className="text-xs text-fg-3">Grade {c.grade_level}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title={`Subjects (${subjects.length})`} action={<NewSubjectButton />} />
          <ul className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <li key={s.id} className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-900/60 px-3 py-1.5 text-sm">
                <span className="size-2.5 rounded-full" style={{ background: s.color }} aria-hidden /> {s.name}
                <span className="text-[10px] font-bold text-fg-3">{s.short}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card>
        <CardHeader title="Teaching assignments" subtitle="Determines which classes' academic records each teacher can access" action={<AssignTeacherButton teachers={teachers} classes={classes.map((c) => ({ id: c.id, name: c.name }))} subjects={subjects.map((s) => ({ id: s.id, name: s.name }))} />} />
        <div className="grid gap-4 @3xl:grid-cols-3">
          {classes.map((c) => (
            <div key={c.id} className="rounded-2xl border border-line bg-ink-900/50 p-4">
              <p className="mb-3 font-display font-semibold">{c.name}</p>
              <ul className="space-y-1.5 text-sm">
                {matrix
                  .filter((m) => m.class_id === c.id)
                  .map((m) => (
                    <li key={m.subject_name} className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-fg-2">
                        <span className="size-2 rounded-full" style={{ background: m.subject_color }} aria-hidden /> {m.subject_name}
                      </span>
                      <span className="truncate text-xs text-fg-3">{m.teacher_name}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
