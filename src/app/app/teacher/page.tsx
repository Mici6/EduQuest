import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, HandHeart, Megaphone, NotebookPen, Users, WandSparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, IconChip } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { announcementsFor, classStats, teacherClasses, todaysClasses } from "@/lib/domain/catalog";
import { teacherInbox } from "@/lib/domain/teacher";
import { cn, fmtGrade, greeting, relativeTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Teacher dashboard" };

export default async function TeacherDashboard() {
  const actor = await requireActor(["teacher"]);
  const db = getDb();
  const now = new Date();
  const user = db.get<{ avatar_hue: number; title: string | null }>(`SELECT avatar_hue, title FROM users WHERE id = ?`, actor.id)!;
  const pairs = teacherClasses(db, actor);
  const stats = pairs.map((p) => ({ ...p, stats: classStats(db, actor, p.class_id, p.subject_id) }));
  const students = new Set(stats.flatMap((s) => s.stats.roster.map((r) => r.id))).size;
  const avgs = stats.map((s) => s.stats.average).filter((v): v is number => v != null);
  const inbox = teacherInbox(db, actor, now);
  const today = todaysClasses(db, actor, now);
  const news = announcementsFor(db, actor, 4);

  return (
    <div className="space-y-5">
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-iris-600/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5 @3xl:flex-row @3xl:items-center @3xl:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={actor.displayName} hue={user.avatar_hue} size={56} />
            <div>
              <p className="text-sm text-fg-2">{greeting(now)},</p>
              <h1 className="font-display text-[28px] font-semibold leading-tight">{actor.displayName}</h1>
              <p className="text-xs text-fg-3">{user.title}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/app/teacher/attendance" variant="secondary" size="sm">
              <ClipboardCheck /> Take attendance
            </ButtonLink>
            <ButtonLink href="/app/teacher/assignments" variant="secondary" size="sm">
              <NotebookPen /> Assignments
            </ButtonLink>
            <ButtonLink href="/app/teacher/studio" variant="iris" size="sm">
              <WandSparkles /> AI Studio
            </ButtonLink>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 @4xl:grid-cols-4">
        <StatCard label="Classes taught" value={new Set(pairs.map((p) => p.class_id)).size} hint={`${pairs.length} class–subject groups`} accent="sun" icon={<Users />} />
        <StatCard label="Students" value={students} accent="iris" />
        <StatCard label="Average across groups" value={fmtGrade(avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null)} accent="mint" />
        <StatCard label="Submissions to review" value={inbox.toReview} accent="ember" />
      </div>

      <div className="grid gap-5 @4xl:grid-cols-12">
        <div className="space-y-5 @4xl:col-span-8">
          <Card>
            <CardHeader title="Your classes" subtitle="Academic indicators only — support records are held by authorised support staff" action={<ButtonLink href="/app/teacher/classes" variant="ghost" size="sm">All <ArrowRight /></ButtonLink>} />
            <ul className="grid gap-3 @2xl:grid-cols-2">
              {stats.map((s) => (
                <li key={s.class_id + s.subject_id}>
                  <Link href={`/app/teacher/classes/${s.class_id}?subject=${s.subject_id}`} className="block rounded-[22px] border border-line bg-ink-900/60 p-4 transition-colors hover:border-line-strong">
                    <div className="flex items-center justify-between">
                      <p className="font-display text-lg font-semibold">{s.class_name}</p>
                      <span className="inline-flex items-center gap-1.5 text-xs text-fg-2">
                        <span className="size-2 rounded-full" style={{ background: s.subject_color }} aria-hidden /> {s.subject_name}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                      {[
                        ["Average", fmtGrade(s.stats.average)],
                        ["Attendance", s.stats.attendance != null ? `${s.stats.attendance}%` : "—"],
                        ["Homework", s.stats.completion != null ? `${s.stats.completion}%` : "—"],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-xl bg-white/[0.04] py-2">
                          <dt className="text-[10px] text-fg-3">{k}</dt>
                          <dd className="font-display text-base font-semibold tabular-nums">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader icon={<IconChip tone="iris">{<Megaphone />}</IconChip>} title="Recent announcements" action={<ButtonLink href="/app/teacher/announcements" variant="ghost" size="sm">Post <ArrowRight /></ButtonLink>} />
            <ul className="space-y-3">
              {news.map((a) => (
                <li key={a.id} className="rounded-2xl border border-line bg-ink-900/60 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <Badge tone={a.class_name ? "iris" : "neutral"}>{a.class_name ?? "School"}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-fg-3">{a.body}</p>
                  <p className="mt-1.5 text-[11px] text-fg-3">
                    {a.author_name} · {relativeTime(a.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="space-y-5 @4xl:col-span-4">
          <Card>
            <CardHeader title="Needs your attention" />
            <ul className="space-y-2">
              {[
                { href: "/app/teacher/assignments", label: "Submissions to review", n: inbox.toReview, icon: NotebookPen },
                { href: "/app/teacher/volunteering", label: "Volunteering to verify", n: inbox.toVerify, icon: HandHeart },
                { href: "/app/teacher/studio?tab=drafts", label: "AI drafts awaiting review", n: inbox.drafts, icon: WandSparkles },
              ].map((x) => (
                <li key={x.href}>
                  <Link href={x.href} className="flex items-center gap-3 rounded-2xl border border-line bg-ink-900/60 px-3.5 py-3 hover:border-line-strong">
                    <x.icon className="size-4 text-fg-3" aria-hidden />
                    <span className="flex-1 text-sm">{x.label}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", x.n ? "bg-ember text-ink-950" : "bg-white/[0.06] text-fg-3")}>{x.n}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Today" subtitle={now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} />
            {today.length ? (
              <ol className="space-y-2">
                {today.map((c) => (
                  <li key={c.id} className={cn("flex items-center gap-3 rounded-2xl px-3 py-2", c.state === "now" && "bg-sun-300/[0.08] ring-1 ring-sun-300/30", c.state === "done" && "opacity-55")}>
                    <span className="w-11 text-xs tabular-nums text-fg-2">{c.starts_at}</span>
                    <span className="size-2 rounded-full" style={{ background: c.subject_color }} aria-hidden />
                    <span className="flex-1 truncate text-sm font-medium">
                      {c.class_name} · {c.subject_name}
                    </span>
                    <span className="text-xs text-fg-3">{c.room}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="No lessons today" />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
