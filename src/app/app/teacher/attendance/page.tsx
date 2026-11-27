import type { Metadata } from "next";
import { AttendanceSheet } from "@/components/teacher/attendance-sheet";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { attendanceSheet, teacherClasses } from "@/lib/domain/catalog";
import { isoDate } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage({ searchParams }: PageProps<"/app/teacher/attendance">) {
  const actor = await requireActor(["teacher"]);
  const sp = await searchParams;
  const db = getDb();
  const pairs = teacherClasses(db, actor);
  const key = typeof sp.group === "string" ? sp.group : `${pairs[0]!.class_id}|${pairs[0]!.subject_id}`;
  const pair = pairs.find((p) => `${p.class_id}|${p.subject_id}` === key) ?? pairs[0]!;
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : isoDate();
  const rows = attendanceSheet(db, actor, pair.class_id, pair.subject_id, date);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Teaching" title="Attendance" description="Record attendance for a lesson. Students see their own record; it never affects XP or credits." />
      <Card className="mb-5">
        <form className="grid gap-3 @2xl:grid-cols-[1fr_auto_auto] @2xl:items-end" action="/app/teacher/attendance">
          <label className="text-xs font-semibold text-fg-2">
            Class & subject
            <select name="group" defaultValue={`${pair.class_id}|${pair.subject_id}`} className="mt-1.5 h-11 w-full rounded-2xl border border-line bg-ink-900/80 px-3.5 text-sm text-fg">
              {pairs.map((p) => (
                <option key={`${p.class_id}|${p.subject_id}`} value={`${p.class_id}|${p.subject_id}`}>
                  {p.class_name} · {p.subject_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-fg-2">
            Date
            <input type="date" name="date" defaultValue={date} max={isoDate()} className="mt-1.5 h-11 w-full rounded-2xl border border-line bg-ink-900/80 px-3.5 text-sm text-fg" />
          </label>
          <button type="submit" className="h-11 rounded-full bg-ink-700 px-5 text-sm font-semibold hover:bg-ink-750">
            Load
          </button>
        </form>
      </Card>
      <Card>
        <CardHeader title={`${pair.class_name} · ${pair.subject_name}`} subtitle={new Date(date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} />
        <AttendanceSheet key={`${pair.class_id}${pair.subject_id}${date}`} rows={rows} classId={pair.class_id} subjectId={pair.subject_id} date={date} />
      </Card>
    </div>
  );
}
