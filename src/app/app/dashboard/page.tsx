import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Clock,
  Coins,
  Flame,
  WandSparkles,
  MapPin,
  NotebookPen,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { LogStudyButton, QuestList } from "@/components/student/quest-list";
import { Avatar } from "@/components/ui/avatar";
import { Badge, SubjectTag } from "@/components/ui/badge";
import { SnowLeopard } from "@/components/companion/snow-leopard";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, IconChip } from "@/components/ui/card";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { getAiMode } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { schoolSettings } from "@/lib/domain/admin";
import {
  attendanceFor,
  attendanceStats,
  homeworkFor,
  nextClass,
  overallAverage,
  subjectSummaries,
  todaysClasses,
  upcomingEvents,
} from "@/lib/domain/catalog";
import { myAiCourses } from "@/lib/domain/ai-courses";
import { creditSummary } from "@/lib/domain/credits";
import { levelInfo, questsFor, streak, studyMinutesToday } from "@/lib/domain/gamification";
import { getUserSettings, unreadCount } from "@/lib/domain/notifications";
import { fmtDate, fmtGrade, greeting, relativeTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Dashboard" };

function minutesUntil(hhmm: string, now: Date) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = new Date(now);
  t.setHours(h!, m!, 0, 0);
  return Math.round((t.getTime() - now.getTime()) / 60000);
}

export default async function StudentDashboard() {
  const actor = await requireActor(["student"]);
  const db = getDb();
  const now = new Date();
  const user = db.get<{ avatar_hue: number }>(`SELECT avatar_hue FROM users WHERE id = ?`, actor.id)!;
  const settings = schoolSettings(db, actor.schoolId);
  const level = levelInfo(db, actor.id);
  const st = streak(db, actor.id);
  const credits = creditSummary(db, actor.id);
  const quests = settings.questsEnabled ? questsFor(db, actor.id, actor.schoolId) : [];
  const today = todaysClasses(db, actor, now);
  const next = nextClass(db, actor, now);
  const homework = homeworkFor(db, actor, actor.id).filter((h) => h.state === "open" || h.state === "due_soon" || h.state === "overdue");
  const subjects = subjectSummaries(db, actor, actor.id);
  const avg = overallAverage(subjects);
  const att = attendanceStats(attendanceFor(db, actor, actor.id));
  const events = upcomingEvents(db, actor, 10);
  const aiCourses = myAiCourses(db, actor);
  const activeCourse = aiCourses.find((c) => c.status === "approved") ?? null;
  const minutes = studyMinutesToday(db, actor.id, now);
  const goal = getUserSettings(db, actor.id).dailyStudyGoalMinutes ?? 30;
  const unread = unreadCount(db, actor);
  const aiMode = getAiMode();
  const first = actor.displayName.split(" ")[0];
  const dailyDone = quests.filter((q) => q.cadence === "daily" && q.completed_at).length;
  const dailyTotal = quests.filter((q) => q.cadence === "daily").length;
  const weakest = [...subjects].filter((s) => s.average != null).sort((a, b) => a.average! + (a.trend ?? 0) / 2 - (b.average! + (b.trend ?? 0) / 2))[0];

  return (
    <div className="space-y-5">
      {/* Welcome + next class */}
      <div className="grid gap-5 @4xl:grid-cols-12">
        <Card className="relative overflow-hidden @4xl:col-span-8">
          <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-sun-300/10 blur-3xl" aria-hidden />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar name={actor.displayName} hue={user.avatar_hue} size={56} />
              <div>
                <p className="text-sm text-fg-2">{greeting(now)},</p>
                <h1 className="font-display text-[28px] font-semibold leading-tight sm:text-[32px]">{first}.</h1>
              </div>
            </div>
            <Link
              href="/app/notifications"
              className="relative inline-flex h-11 items-center gap-2 self-start rounded-full border border-line bg-ink-900/70 px-4 text-sm font-medium text-fg-2 hover:text-fg sm:self-auto"
            >
              <Bell className="size-4" aria-hidden />
              {unread ? `${unread} new` : "All caught up"}
              {unread ? <span className="absolute right-2 top-2 size-2 rounded-full bg-ember" aria-hidden /> : null}
            </Link>
          </div>
          <p className="relative mt-5 font-display text-2xl font-semibold leading-snug sm:text-[28px]">
            Ready to make <span className="text-grad-sun">today count?</span>
          </p>
          <div className="relative mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-fg">
                  Level {level.level} · {level.title}
                </span>
                <span className="tabular-nums text-fg-3">
                  {level.nextLevelXp ? `${level.xp - level.levelFloor} / ${level.nextLevelXp - level.levelFloor} XP` : `${level.xp} XP`}
                </span>
              </div>
              <ProgressBar value={level.progress} size="lg" label="Progress to next level" />
              <p className="mt-2 text-xs text-fg-3">{level.nextLevelXp ? `${level.nextLevelXp - level.xp} XP to ${level.nextTitle}` : "Maximum level reached"}</p>
            </div>
            <div className="flex gap-2">
              <div className="rounded-2xl border border-line bg-ink-900/70 px-4 py-2.5 text-center">
                <p className="inline-flex items-center gap-1 font-display text-xl font-semibold text-amber">
                  <Flame className="size-5" aria-hidden /> {st.current}
                </p>
                <p className="text-[10px] font-medium text-fg-3">{st.activeToday ? "day streak" : st.current ? "keep it going!" : "start a streak"}</p>
              </div>
              <div className="rounded-2xl border border-line bg-ink-900/70 px-4 py-2.5 text-center">
                <p className="inline-flex items-center gap-1 font-display text-xl font-semibold text-sun-200">
                  <Coins className="size-5" aria-hidden /> {credits.balance}
                </p>
                <p className="text-[10px] font-medium text-fg-3">credits</p>
              </div>
            </div>
          </div>
        </Card>

        <Card tone="sun" className="relative overflow-hidden @4xl:col-span-4">
          <div className="absolute -bottom-10 -right-10 size-40 rounded-full border-[18px] border-ink-950/[0.07]" aria-hidden />
          {next ? (
            <div className="relative flex h-full flex-col">
              <div className="flex items-start justify-between">
                <p className="text-sm font-semibold text-ink-950/70">{next.inDays === 0 ? "Next class" : next.inDays === 1 ? "First class tomorrow" : `Next class · ${fmtDate(next.date, { weekday: "long" })}`}</p>
                <Link href="/app/schedule" className="inline-flex size-9 items-center justify-center rounded-full bg-ink-950/10 hover:bg-ink-950/20" aria-label="Open schedule">
                  <ArrowUpRight className="size-4" />
                </Link>
              </div>
              <p className="mt-4 font-display text-[28px] font-semibold leading-tight">{next.subject_name}</p>
              <p className="mt-1 text-sm text-ink-950/75">with {next.teacher_name}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-6 text-sm font-semibold">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-950/10 px-3 py-1.5">
                  <Clock className="size-4" aria-hidden /> {next.starts_at}–{next.ends_at}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-950/10 px-3 py-1.5">
                  <MapPin className="size-4" aria-hidden /> {next.room}
                </span>
                {next.inDays === 0 ? (
                  <span className="inline-flex items-center rounded-full bg-ink-950 px-3 py-1.5 text-sun-100">
                    {(() => {
                      const m = minutesUntil(next.starts_at, now);
                      return m < 60 ? `in ${m} min` : `in ${Math.floor(m / 60)} h ${m % 60} min`;
                    })()}
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-ink-950/70">Next class</p>
              <p className="mt-4 font-display text-2xl font-semibold">No classes scheduled</p>
            </div>
          )}
        </Card>
      </div>

      {/* Quests + today's schedule */}
      <div className="grid gap-5 @4xl:grid-cols-12">
        <Card className="@4xl:col-span-7" id="quests">
          <CardHeader
            icon={<IconChip>{<Target />}</IconChip>}
            title="Daily quests"
            subtitle={settings.questsEnabled ? `${dailyDone} of ${dailyTotal} complete today` : "Quests are turned off by your school."}
            action={<LogStudyButton />}
          />
          {settings.questsEnabled ? (
            <>
              <QuestList quests={quests.filter((q) => q.cadence === "daily")} />
              <Link href="/app/progress" className="mt-3 flex items-center justify-between rounded-2xl border border-dashed border-line-strong px-4 py-3 text-xs text-fg-2 hover:text-fg">
                <span>
                  Weekly challenges:{" "}
                  <strong className="text-fg">
                    {quests.filter((q) => q.cadence === "weekly" && q.completed_at).length}/{quests.filter((q) => q.cadence === "weekly").length} complete
                  </strong>
                </span>
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </>
          ) : (
            <EmptyState title="Quests are paused" icon={<Target />}>
              Your school administrator has turned off quests.
            </EmptyState>
          )}
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-ink-900/60 px-4 py-3 text-xs text-fg-2">
            <span>
              Focused study today: <strong className="text-fg">{minutes} min</strong> of your {goal}-minute goal
            </span>
            <ProgressRing value={minutes / goal} size={34} stroke={4} label={`${minutes} of ${goal} minutes`} />
          </div>
        </Card>

        <Card className="@4xl:col-span-5">
          <CardHeader
            icon={<IconChip tone="iris">{<CalendarDays />}</IconChip>}
            title="Today's classes"
            subtitle={now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            action={
              <ButtonLink href="/app/schedule" variant="ghost" size="sm">
                Week <ArrowRight />
              </ButtonLink>
            }
          />
          {today.length ? (
            <ol className="relative space-y-1 before:absolute before:bottom-3 before:left-[52px] before:top-3 before:w-px before:bg-line">
              {today.map((c) => (
                <li key={c.id} className={cn("relative flex items-center gap-3 rounded-2xl px-2 py-2", c.state === "now" && "bg-sun-300/[0.08] ring-1 ring-sun-300/30")}>
                  <span className={cn("w-10 shrink-0 text-right text-xs tabular-nums", c.state === "done" ? "text-fg-3" : "text-fg-2")}>{c.starts_at}</span>
                  <span className="relative z-10 size-2.5 shrink-0 rounded-full ring-4 ring-ink-800" style={{ background: c.state === "done" ? "var(--color-line-strong)" : c.subject_color }} aria-hidden />
                  <div className={cn("min-w-0 flex-1", c.state === "done" && "opacity-55")}>
                    <p className="truncate text-sm font-semibold">{c.subject_name}</p>
                    <p className="truncate text-xs text-fg-3">
                      {c.room} · {c.teacher_name}
                    </p>
                  </div>
                  {c.state === "now" ? <Badge tone="solid">Now</Badge> : c.state === "done" ? <span className="text-[11px] text-fg-3">Done</span> : null}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No classes today" icon={<CalendarDays />}>
              Enjoy your day off — your next class is {next ? `${next.subject_name} on ${fmtDate(next.date, { weekday: "long" })}` : "not scheduled yet"}.
            </EmptyState>
          )}
        </Card>
      </div>

      {/* Academic + homework */}
      <div className="grid gap-5 @4xl:grid-cols-12">
        <Card className="@4xl:col-span-7">
          <CardHeader
            title="Academic overview"
            subtitle="Weighted averages from your teachers' grades"
            action={
              <ButtonLink href="/app/catalog" variant="ghost" size="sm">
                Catalog <ArrowRight />
              </ButtonLink>
            }
          />
          <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
            <div className="flex flex-row items-center gap-5 sm:flex-col sm:justify-center">
              <ProgressRing value={(avg ?? 0) / 10} size={112} stroke={10} label={`Overall average ${fmtGrade(avg)}`}>
                <div>
                  <p className="font-display text-2xl font-semibold tabular-nums">{fmtGrade(avg)}</p>
                  <p className="text-[10px] text-fg-3">average</p>
                </div>
              </ProgressRing>
              <ProgressRing value={(att.rate ?? 0) / 100} size={84} stroke={8} tone="iris" label={`Attendance ${att.rate ?? 0}%`}>
                <div>
                  <p className="font-display text-base font-semibold tabular-nums">{att.rate ?? "—"}%</p>
                  <p className="text-[9px] text-fg-3">attendance</p>
                </div>
              </ProgressRing>
            </div>
            <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {subjects.map((s) => (
                <li key={s.id}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <SubjectTag name={s.name} color={s.color} />
                    <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                      {s.trend != null && Math.abs(s.trend) >= 0.3 ? (
                        s.trend > 0 ? (
                          <TrendingUp className="size-3.5 text-mint" aria-label="improving" />
                        ) : (
                          <TrendingDown className="size-3.5 text-amber" aria-label="lower recently" />
                        )
                      ) : null}
                      {fmtGrade(s.average)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <div className="h-full rounded-full" style={{ width: `${((s.average ?? 0) / 10) * 100}%`, background: s.color }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className="@4xl:col-span-5">
          <CardHeader
            icon={<IconChip tone="ember">{<NotebookPen />}</IconChip>}
            title="Homework due"
            subtitle={homework.length ? `${homework.length} to hand in` : "Nothing pending"}
            action={
              <ButtonLink href="/app/homework" variant="ghost" size="sm">
                All <ArrowRight />
              </ButtonLink>
            }
          />
          {homework.length ? (
            <ul className="space-y-2">
              {homework.slice(0, 5).map((h) => (
                <li key={h.id}>
                  <Link href={`/app/homework?open=${h.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-ink-900/60 px-3.5 py-3 transition-colors hover:border-line-strong">
                    <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: h.subject_color }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{h.title}</p>
                      <p className="text-xs text-fg-3">{h.subject_name}</p>
                    </div>
                    <Badge tone={h.state === "overdue" ? "rose" : h.state === "due_soon" ? "ember" : "neutral"}>
                      {h.state === "overdue" ? "Overdue" : relativeTime(h.due_at, now)}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="All caught up" icon={<NotebookPen />}>
              You've handed in everything. Nice work!
            </EmptyState>
          )}
        </Card>
      </div>

      {/* AI + courses + events */}
      <div className="grid gap-5 @4xl:grid-cols-12">
        <Card tone="iris" className="relative overflow-hidden @4xl:col-span-5">
          <div className="absolute -right-16 -top-16 size-56 rounded-full bg-white/15 blur-2xl" aria-hidden />
          <div className="relative">
            <div className="flex items-center justify-between">
              <SnowLeopard mood="happy" className="size-14" title="Irbis" />
              <Badge tone="dark">{aiMode === "cloud" ? "Cloud AI" : aiMode === "browser" ? "On-device AI" : aiMode === "simulated" ? "Simulated mode" : "Not configured"}</Badge>
            </div>
            <h2 className="mt-3 font-display text-2xl font-semibold">Study with Irbis</h2>
            <p className="mt-1 text-sm text-ink-950/75">Your snow leopard tutor. Ask about your lessons: Irbis cites your teachers' materials and says when an answer goes beyond them.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                weakest ? `Help me revise ${weakest.name.toLowerCase()}` : "Explain photosynthesis simply",
                "Quiz me on Newton's laws",
                "What caused the French Revolution?",
              ].map((q) => (
                <Link key={q} href={`/app/study/chat?q=${encodeURIComponent(q)}`} className="rounded-full bg-ink-950/10 px-3 py-1.5 text-xs font-semibold hover:bg-ink-950/20">
                  {q}
                </Link>
              ))}
            </div>
            <ButtonLink href="/app/study/chat" variant="dark" className="mt-5">
              Ask Irbis <ArrowRight />
            </ButtonLink>
          </div>
        </Card>

        <Card className="@4xl:col-span-4">
          <CardHeader
            icon={<IconChip tone="ember">{<WandSparkles />}</IconChip>}
            title="Courses"
            subtitle="AI courses, reviewed and accredited by your teachers"
            action={
              <ButtonLink href="/app/courses" variant="ghost" size="sm">
                Open <ArrowRight />
              </ButtonLink>
            }
          />
          <p className="font-display text-4xl font-semibold tabular-nums">
            {aiCourses.filter((c) => c.status === "accredited").length}
            <span className="ml-1.5 text-base font-medium text-fg-3">accredited</span>
          </p>
          <p className="mt-1 text-xs text-fg-3">
            {aiCourses.filter((c) => c.status === "pending_review").length} waiting for review · {credits.balance} credits for ready-made courses
          </p>
          {activeCourse ? (
            <Link href={`/app/courses/ai/${activeCourse.id}`} className="mt-4 block rounded-2xl border border-line bg-ink-900/60 p-3.5 hover:border-line-strong">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-semibold">Continue: {activeCourse.title}</span>
                <span className="shrink-0 tabular-nums text-fg-3">
                  {activeCourse.lessonsDone}/{activeCourse.lessons}
                </span>
              </div>
              <ProgressBar value={activeCourse.lessonsDone / activeCourse.lessons} tone="ember" label={`Progress in ${activeCourse.title}`} />
            </Link>
          ) : null}
          <ButtonLink href="/app/courses" variant="secondary" size="sm" className="mt-4">
            <WandSparkles /> Create a course with AI
          </ButtonLink>
        </Card>

        <Card className="@4xl:col-span-3">
          <CardHeader title="Coming up" subtitle="Next 10 days" />
          {events.length ? (
            <ul className="space-y-3">
              {events.map((e) => {
                const d = new Date(e.date + "T00:00:00");
                return (
                  <li key={e.id} className="flex items-center gap-3">
                    <span className={cn("flex size-11 shrink-0 flex-col items-center justify-center rounded-full text-ink-950", e.kind === "exam" ? "bg-ember" : e.kind === "event" ? "bg-sun-200" : "bg-iris-300")}>
                      <span className="text-[13px] font-bold leading-none">{d.getDate()}</span>
                      <span className="text-[9px] font-semibold uppercase">{d.toLocaleDateString("en-GB", { month: "short" })}</span>
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug">{e.title}</p>
                      <p className="text-[11px] capitalize text-fg-3">{e.kind}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-fg-3">No events in the next 10 days.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
