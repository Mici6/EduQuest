import type { Metadata } from "next";
import { Megaphone, Pin, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import { BarsChart, TrendChart } from "@/components/charts/charts";
import { Avatar } from "@/components/ui/avatar";
import { Badge, SubjectTag } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/link-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { EmptyState, Notice } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import type { Actor } from "@/lib/auth/types";
import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db/client";
import {
  announcementsFor,
  attendanceFor,
  attendanceStats,
  gradeProgression,
  gradesFor,
  overallAverage,
  subjectSummaries,
  teachersFor,
  weightedAverage,
} from "@/lib/domain/catalog";
import { addDays, isoDate, startOfWeek } from "@/lib/utils/dates";
import { cn, fmtDate, fmtGrade, relativeTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Catalog" };

const TABS = [
  { id: "grades", label: "Grades" },
  { id: "attendance", label: "Attendance" },
  { id: "announcements", label: "Announcements" },
  { id: "teachers", label: "Teachers" },
  { id: "stats", label: "Statistics" },
] as const;

const KIND_LABEL: Record<string, string> = { test: "Test", quiz: "Quiz", oral: "Oral", project: "Project", homework: "Homework" };

export default async function CatalogPage({ searchParams }: PageProps<"/app/catalog">) {
  const actor = await requireActor(["student"]);
  const sp = await searchParams;
  const tab = (TABS.find((t) => t.id === sp.tab)?.id ?? "grades") as (typeof TABS)[number]["id"];
  const subject = typeof sp.subject === "string" ? sp.subject : null;
  const db = getDb();

  return (
    <div>
      <PageHeader eyebrow="Electronic catalog" title="Your school record" description="Grades, attendance and announcements from your teachers. Only you (and staff who teach or support you) can see this." />
      <LinkTabs label="Catalog sections" className="mb-6" items={TABS.map((t) => ({ href: `/app/catalog?tab=${t.id}`, label: t.label, active: t.id === tab }))} />
      {tab === "grades" ? <GradesView db={db} actor={actor} subject={subject} /> : null}
      {tab === "attendance" ? <AttendanceView db={db} actor={actor} /> : null}
      {tab === "announcements" ? <AnnouncementsView db={db} actor={actor} /> : null}
      {tab === "teachers" ? <TeachersView db={db} actor={actor} /> : null}
      {tab === "stats" ? <StatsView db={db} actor={actor} /> : null}
    </div>
  );
}

function GradesView({ db, actor, subject }: { db: Db; actor: Actor; subject: string | null }) {
  const subjects = subjectSummaries(db, actor, actor.id);
  const grades = gradesFor(db, actor, actor.id).filter((g) => !subject || g.subject_id === subject);
  const avg = overallAverage(subjects);
  const progression = gradeProgression(db, actor, actor.id, 10);
  return (
    <div className="space-y-5">
      <div className="grid gap-5 @4xl:grid-cols-12">
        <Card className="@4xl:col-span-8">
          <TrendChart
            title="Overall average over time"
            description="Cumulative weighted average at the end of each week (tests count double)"
            data={progression.map((p) => ({ label: p.label, value: p.average }))}
            domain={[4, 10]}
            name="Average"
          />
        </Card>
        <div className="grid grid-cols-2 gap-3 @4xl:col-span-4 @4xl:grid-cols-1">
          <StatCard label="Overall average" value={fmtGrade(avg)} hint="Across all subjects" accent="sun" />
          <StatCard label="Grades this term" value={gradesFor(db, actor, actor.id).length} hint={`${subjects.filter((s) => s.count).length} subjects`} accent="iris" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 @4xl:grid-cols-4">
        {subjects.map((s) => (
          <a
            key={s.id}
            href={subject === s.id ? "/app/catalog?tab=grades" : `/app/catalog?tab=grades&subject=${s.id}`}
            aria-current={subject === s.id ? "true" : undefined}
            className={cn("surface group rounded-[22px] p-4 transition-all hover:-translate-y-0.5", subject === s.id && "ring-2 ring-sun-300/60")}
          >
            <div className="flex items-center justify-between">
              <span className="size-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
              {s.trend != null && Math.abs(s.trend) >= 0.3 ? (
                <Badge tone={s.trend > 0 ? "mint" : "ember"} icon={s.trend > 0 ? <TrendingUp /> : <TrendingDown />}>
                  {s.trend > 0 ? "+" : ""}
                  {s.trend.toFixed(1)}
                </Badge>
              ) : null}
            </div>
            <p className="mt-3 truncate text-sm font-semibold">{s.name}</p>
            <p className="font-display text-3xl font-semibold tabular-nums">{fmtGrade(s.average)}</p>
            <p className="mt-1 truncate text-[11px] text-fg-3">
              {s.count} grades · {s.teacher_name}
            </p>
          </a>
        ))}
      </div>

      <Card>
        <CardHeader title={subject ? `Grades · ${subjects.find((s) => s.id === subject)?.name ?? ""}` : "All assessments"} subtitle={`${grades.length} entries · newest first`} />
        {grades.length ? (
          <>
            <div className="hidden overflow-x-auto @2xl:block">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-fg-3">
                  <tr className="border-b border-line">
                    <th scope="col" className="py-2.5 pr-4 font-semibold">Date</th>
                    <th scope="col" className="py-2.5 pr-4 font-semibold">Subject</th>
                    <th scope="col" className="py-2.5 pr-4 font-semibold">Assessment</th>
                    <th scope="col" className="py-2.5 pr-4 font-semibold">Type</th>
                    <th scope="col" className="py-2.5 pr-4 font-semibold">Teacher</th>
                    <th scope="col" className="py-2.5 text-right font-semibold">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((g) => (
                    <tr key={g.id} className="border-b border-line/50 last:border-0">
                      <td className="py-3 pr-4 tabular-nums text-fg-2">{fmtDate(g.graded_on)}</td>
                      <td className="py-3 pr-4">
                        <SubjectTag name={g.subject_name} color={g.subject_color} />
                      </td>
                      <td className="py-3 pr-4 font-medium">{g.title}</td>
                      <td className="py-3 pr-4">
                        <Badge>{KIND_LABEL[g.kind] ?? g.kind}{g.weight > 1 ? ` ×${g.weight}` : ""}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-fg-2">{g.teacher_name}</td>
                      <td className="py-3 text-right">
                        <GradePill value={g.value} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="space-y-2 @2xl:hidden">
              {grades.map((g) => (
                <li key={g.id} className="flex items-center gap-3 rounded-2xl border border-line bg-ink-900/60 px-3.5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{g.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-3">
                      <SubjectTag name={g.subject_name} color={g.subject_color} /> · {KIND_LABEL[g.kind]} · {fmtDate(g.graded_on)}
                    </p>
                  </div>
                  <GradePill value={g.value} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState title="No grades yet">Grades appear here as soon as your teachers enter them.</EmptyState>
        )}
      </Card>
    </div>
  );
}

function GradePill({ value }: { value: number }) {
  const tone = value >= 9 ? "bg-mint/20 text-mint" : value >= 7 ? "bg-sun-300/20 text-sun-200" : value >= 5 ? "bg-amber/20 text-amber" : "bg-rose/20 text-rose";
  return <span className={cn("inline-flex min-w-10 justify-center rounded-full px-2.5 py-1 font-display text-sm font-semibold tabular-nums", tone)}>{value}</span>;
}

const STATUS_STYLE: Record<string, string> = {
  present: "bg-mint/25 text-mint",
  late: "bg-amber/30 text-amber",
  absent: "bg-rose/30 text-rose",
  excused: "bg-sky/25 text-sky",
};
const STATUS_RANK: Record<string, number> = { present: 0, excused: 1, late: 2, absent: 3 };

function AttendanceView({ db, actor }: { db: Db; actor: Actor }) {
  const rows = attendanceFor(db, actor, actor.id);
  const stats = attendanceStats(rows);
  const byDay = new Map<string, string>();
  for (const r of rows) {
    const prev = byDay.get(r.date);
    if (!prev || STATUS_RANK[r.status]! > STATUS_RANK[prev]!) byDay.set(r.date, r.status);
  }
  const weeks = 9;
  const start = addDays(startOfWeek(new Date()), -7 * (weeks - 1));
  const todayIso = isoDate();
  const notable = rows.filter((r) => r.status !== "present").slice(0, 12);
  return (
    <div className="space-y-5">
      <Notice tone="info" icon={<ShieldCheck />} title="Attendance never affects your XP or credits">
        Absences are recorded for your school record only. EduQuest never removes rewards as a penalty.
      </Notice>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Attendance rate" value={`${stats.rate ?? "—"}%`} accent="mint" />
        <StatCard label="Present" value={stats.present} />
        <StatCard label="Late" value={stats.late} />
        <StatCard label="Absent" value={stats.absent} />
        <StatCard label="Excused" value={stats.excused} />
      </div>
      <div className="grid gap-5 @4xl:grid-cols-12">
        <Card className="@4xl:col-span-7">
          <CardHeader title="Last nine weeks" subtitle="Each circle is a school day, coloured by that day's most significant record" />
          <div className="overflow-x-auto">
            <table className="mx-auto border-separate border-spacing-1.5 text-center sm:border-spacing-2">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-wide text-fg-3">
                  {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
                    <th key={d} scope="col">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: weeks }, (_, w) => (
                  <tr key={w}>
                    {Array.from({ length: 5 }, (_, d) => {
                      const day = addDays(start, w * 7 + d);
                      const iso = isoDate(day);
                      const status = byDay.get(iso);
                      const future = iso > todayIso;
                      return (
                        <td key={d}>
                          <span
                            title={`${fmtDate(iso, { weekday: "short", day: "numeric", month: "short" })}: ${status ?? (future ? "upcoming" : "no record")}`}
                            className={cn(
                              "inline-flex size-9 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums sm:size-10",
                              status ? STATUS_STYLE[status] : future ? "border border-dashed border-line text-fg-3" : "bg-ink-900 text-fg-3",
                              iso === todayIso && "ring-2 ring-sun-300",
                            )}
                          >
                            {day.getDate()}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-fg-2">
            {Object.keys(STATUS_STYLE).map((s) => (
              <li key={s} className="inline-flex items-center gap-1.5 capitalize">
                <span className={cn("size-2.5 rounded-full", STATUS_STYLE[s])} aria-hidden /> {s}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="@4xl:col-span-5">
          <CardHeader title="Absences & late arrivals" subtitle="Most recent first" />
          {notable.length ? (
            <ul className="space-y-2">
              {notable.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-line bg-ink-900/60 px-3.5 py-2.5">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", STATUS_STYLE[r.status])}>{r.status}</span>
                  <SubjectTag name={r.subject_name} color={r.subject_color} className="min-w-0 flex-1 truncate" />
                  <span className="text-xs tabular-nums text-fg-3">{fmtDate(r.date)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Perfect attendance">No absences or late arrivals recorded.</EmptyState>
          )}
        </Card>
      </div>
    </div>
  );
}

function AnnouncementsView({ db, actor }: { db: Db; actor: Actor }) {
  const items = announcementsFor(db, actor);
  if (!items.length) return <EmptyState icon={<Megaphone />} title="No announcements">Messages from your teachers and school will appear here.</EmptyState>;
  return (
    <ul className="grid gap-4 @4xl:grid-cols-2">
      {items.map((a) => (
        <li key={a.id}>
          <Card className="h-full">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {a.pinned ? (
                <Badge tone="sun" icon={<Pin />}>
                  Pinned
                </Badge>
              ) : null}
              <Badge tone={a.class_name ? "iris" : "neutral"}>{a.class_name ?? "Whole school"}</Badge>
              <span className="ml-auto text-xs text-fg-3">{relativeTime(a.created_at)}</span>
            </div>
            <h2 className="font-display text-lg font-semibold">{a.title}</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-fg-2">{a.body}</p>
            <p className="mt-4 text-xs text-fg-3">— {a.author_name}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function TeachersView({ db, actor }: { db: Db; actor: Actor }) {
  const teachers = teachersFor(db, actor);
  return (
    <ul className="grid gap-4 sm:grid-cols-2 @4xl:grid-cols-3">
      {teachers.map((t) => (
        <li key={t.id} className="surface flex items-center gap-4 rounded-[22px] p-4">
          <Avatar name={t.display_name} hue={t.avatar_hue} size={48} />
          <div className="min-w-0">
            <p className="font-semibold">{t.display_name}</p>
            <p className="text-xs text-fg-3">{t.title}</p>
            <p className="mt-1.5 text-xs text-fg-2">{t.subjects.split(",").join(" · ")}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function StatsView({ db, actor }: { db: Db; actor: Actor }) {
  const subjects = subjectSummaries(db, actor, actor.id);
  const grades = gradesFor(db, actor, actor.id);
  const att = attendanceFor(db, actor, actor.id);
  const byKind = Object.keys(KIND_LABEL).map((k) => {
    const g = grades.filter((x) => x.kind === k);
    return { kind: KIND_LABEL[k]!, average: weightedAverage(g), count: g.length };
  });
  return (
    <div className="space-y-5">
      <div className="grid gap-5 @4xl:grid-cols-2">
        <Card>
          <BarsChart
            title="Average by subject"
            description="Weighted average out of 10"
            data={subjects.map((s) => ({ label: s.short, average: s.average }))}
            xKey="label"
            series={[{ key: "average", name: "Average" }]}
            domain={[0, 10]}
          />
        </Card>
        <Card>
          <BarsChart
            title="Attendance rate by subject"
            description="Present or late, as a percentage of recorded lessons"
            data={subjects.map((s) => ({ label: s.short, rate: attendanceStats(att.filter((a) => a.subject_name === s.name)).rate }))}
            xKey="label"
            series={[{ key: "rate", name: "Attendance" }]}
            domain={[0, 100]}
            suffix="%"
          />
        </Card>
      </div>
      <Card>
        <CardHeader title="By assessment type" subtitle="Tests are weighted ×2 in averages" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {byKind.map((k) => (
            <div key={k.kind} className="rounded-2xl border border-line bg-ink-900/60 p-4">
              <p className="text-xs text-fg-3">{k.kind}</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{fmtGrade(k.average)}</p>
              <p className="text-[11px] text-fg-3">{k.count} graded</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
