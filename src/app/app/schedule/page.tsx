import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { WeekSchedule } from "@/components/student/week-schedule";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { scheduleFor, upcomingEvents } from "@/lib/domain/catalog";
import { isoDate, weekday } from "@/lib/utils/dates";
import { cn, fmtDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage() {
  const actor = await requireActor(["student", "teacher"]);
  const db = getDb();
  const now = new Date();
  const slots = scheduleFor(db, actor);
  const events = upcomingEvents(db, actor, 40, new Date(now.getFullYear(), now.getMonth(), 1));
  const eventDays = new Map(events.map((e) => [e.date, e.kind]));
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const lead = weekday(first) - 1;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const todayIso = isoDate(now);
  const cells = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(now.getFullYear(), now.getMonth(), i + 1))];
  const upcoming = events.filter((e) => e.date >= todayIso);

  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title="Schedule"
        description={actor.role === "teacher" ? "Your teaching timetable across all classes." : "Your weekly timetable, with rooms and teachers."}
      />
      <div className="grid gap-5 @5xl:grid-cols-12">
        <Card className="@5xl:col-span-8">
          <CardHeader title="This week" subtitle={`${slots.length} lessons · the highlighted lesson is happening now`} />
          <WeekSchedule
            slots={slots.map((s) => ({
              id: s.id,
              weekday: s.weekday,
              starts_at: s.starts_at,
              ends_at: s.ends_at,
              room: s.room,
              subject_name: s.subject_name,
              subject_short: s.subject_short,
              subject_color: s.subject_color,
              teacher_name: s.teacher_name,
              class_name: s.class_name,
            }))}
            todayWd={weekday(now)}
            hhmm={now.toTimeString().slice(0, 5)}
            showClass={actor.role === "teacher"}
          />
        </Card>

        <div className="space-y-5 @5xl:col-span-4">
          <Card className="overflow-hidden !p-0">
            <div className="grad-iris px-5 pb-5 pt-5 text-ink-950 sm:px-6">
              <p className="text-sm font-semibold text-ink-950/70">{now.getFullYear()}</p>
              <p className="font-display text-2xl font-semibold">{now.toLocaleDateString("en-GB", { month: "long" })}</p>
              <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-ink-950/70">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1.5">
                {cells.map((d, i) => {
                  if (!d) return <span key={`e${i}`} />;
                  const iso = isoDate(d);
                  const kind = eventDays.get(iso);
                  const isToday = iso === todayIso;
                  const past = iso < todayIso;
                  return (
                    <span
                      key={iso}
                      title={kind ? events.filter((e) => e.date === iso).map((e) => e.title).join(", ") : undefined}
                      className={cn(
                        "relative mx-auto inline-flex aspect-square w-full max-w-10 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                        isToday ? "bg-sun-200 text-ink-950 shadow-lg" : past ? "bg-ink-950/80 text-fg-2" : "bg-ink-950 text-fg",
                        kind && !isToday && "ring-2 ring-sun-200/90 ring-offset-0",
                      )}
                    >
                      {d.getDate()}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="px-5 py-5 sm:px-6">
              <CardHeader icon={<CalendarDays className="size-5 text-iris-300" />} title="Upcoming" subtitle="Exams, events and meetings" className="mb-3" />
              {upcoming.length ? (
                <ul className="space-y-2.5">
                  {upcoming.slice(0, 6).map((e) => (
                    <li key={e.id} className="flex items-center gap-3">
                      <span className={cn("w-1.5 self-stretch rounded-full", e.kind === "exam" ? "bg-ember" : e.kind === "event" ? "bg-sun-300" : "bg-iris-400")} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{e.title}</p>
                        <p className="text-xs text-fg-3">
                          {fmtDate(e.date, { weekday: "short", day: "numeric", month: "short" })} · <span className="capitalize">{e.kind}</span>
                          {e.class_name ? ` · ${e.class_name}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fg-3">Nothing scheduled this month.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
