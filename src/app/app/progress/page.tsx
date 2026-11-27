import type { Metadata } from "next";
import { Crown, Flame, Lock, ShieldCheck, Trophy } from "lucide-react";
import { BarsChart } from "@/components/charts/charts";
import { FramePicker } from "@/components/student/frame-picker";
import { QuestList } from "@/components/student/quest-list";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { NamedIcon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressRing } from "@/components/ui/progress";
import { Notice } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { schoolSettings } from "@/lib/domain/admin";
import { PROFILE_FRAMES, achievementsFor, activeDays, leaderboard, levelInfo, questsFor, streak, xpByDay, xpHistory } from "@/lib/domain/gamification";
import { getUserSettings } from "@/lib/domain/notifications";
import { addDays, isoDate } from "@/lib/utils/dates";
import { cn, fmtDate, relativeTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Progress" };

const TIER: Record<string, string> = {
  gold: "from-sun-100 via-sun-300 to-ember",
  silver: "from-iris-200 via-iris-300 to-iris-600",
  bronze: "from-amber via-ember to-ember-deep",
};

export default async function ProgressPage() {
  const actor = await requireActor(["student"]);
  const db = getDb();
  const level = levelInfo(db, actor.id);
  const st = streak(db, actor.id);
  const days = activeDays(db, actor.id);
  const settings = schoolSettings(db, actor.schoolId);
  const quests = settings.questsEnabled ? questsFor(db, actor.id, actor.schoolId) : [];
  const achievements = achievementsFor(db, actor.id);
  const earned = achievements.filter((a) => a.earned_at).length;
  const history = xpHistory(db, actor.id, 12);
  const chart = xpByDay(db, actor.id, 14);
  const board = settings.leaderboardEnabled ? leaderboard(db, actor.schoolId) : [];
  const me = getUserSettings(db, actor.id);
  const user = db.get<{ avatar_hue: number }>(`SELECT avatar_hue FROM users WHERE id = ?`, actor.id)!;
  const strip = Array.from({ length: 21 }, (_, i) => isoDate(addDays(new Date(), i - 20)));

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Gamification" title="Your progress" description="XP tracks learning progress and unlocks cosmetic rewards. It's separate from credits, which come only from verified volunteering." />

      <div className="grid gap-5 @4xl:grid-cols-12">
        <Card className="flex flex-col items-center gap-6 sm:flex-row @4xl:col-span-7">
          <ProgressRing value={level.progress} size={150} stroke={12} label={`Level ${level.level}, ${Math.round(level.progress * 100)}% to next level`}>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-3">Level</p>
              <p className="font-display text-5xl font-bold leading-none text-grad-sun">{level.level}</p>
            </div>
          </ProgressRing>
          <div className="min-w-0 text-center sm:text-left">
            <p className="font-display text-2xl font-semibold">{level.title}</p>
            <p className="mt-1 text-sm text-fg-2">{level.xp.toLocaleString()} XP total</p>
            {level.nextLevelXp ? (
              <p className="mt-3 text-sm text-fg-3">
                <strong className="text-fg">{(level.nextLevelXp - level.xp).toLocaleString()} XP</strong> until Level {level.level + 1} · {level.nextTitle}
              </p>
            ) : (
              <p className="mt-3 text-sm text-mint">Maximum level reached!</p>
            )}
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Badge tone="sun" icon={<Trophy />}>
                {earned}/{achievements.length} achievements
              </Badge>
              <Badge tone="ember" icon={<Flame />}>
                Best streak {st.best} days
              </Badge>
            </div>
          </div>
        </Card>
        <Card className="@4xl:col-span-5">
          <CardHeader icon={<Flame className="size-5 text-amber" />} title={`${st.current}-day streak`} subtitle={st.activeToday ? "You've learned something today — nice!" : st.current ? "Do any learning activity today to keep it going" : "Complete a quiz, review cards or log study time to start"} />
          <ol className="grid grid-cols-7 gap-2" aria-label="Activity over the last three weeks">
            {strip.map((d) => {
              const active = days.has(d);
              const today = d === isoDate();
              return (
                <li key={d} className="flex flex-col items-center gap-1">
                  <span
                    title={`${fmtDate(d, { weekday: "short", day: "numeric", month: "short" })}${active ? ": active" : ""}`}
                    className={cn("inline-flex aspect-square w-full max-w-9 items-center justify-center rounded-full text-[10px] font-semibold", active ? "bg-amber text-ink-950" : "bg-ink-900 text-fg-3", today && "ring-2 ring-sun-200")}
                  >
                    {active ? <Flame className="size-3.5" aria-label="active" /> : new Date(d + "T00:00:00").getDate()}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-[11px] text-fg-3">Streaks never cost you anything if you miss a day — they simply restart.</p>
        </Card>
      </div>

      <div className="grid gap-5 @4xl:grid-cols-12">
        <Card className="@4xl:col-span-7">
          <BarsChart title="XP earned" description="Last 14 days" data={chart.map((d) => ({ label: fmtDate(d.day), xp: d.xp }))} xKey="label" series={[{ key: "xp", name: "XP" }]} highlightLast />
        </Card>
        <Card className="@4xl:col-span-5">
          <CardHeader title="Recent XP" />
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 text-sm">
                <span className="w-14 shrink-0 font-display font-semibold tabular-nums text-sun-200">+{h.amount}</span>
                <span className="min-w-0 flex-1 truncate text-fg-2">{h.reason}</span>
                <span className="shrink-0 text-[11px] text-fg-3">{relativeTime(h.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {quests.length ? (
        <div className="grid gap-5 @4xl:grid-cols-2">
          <Card>
            <CardHeader title="Daily quests" subtitle="Small, achievable goals — they reset at midnight" />
            <QuestList quests={quests.filter((q) => q.cadence === "daily")} compact />
          </Card>
          <Card>
            <CardHeader title="Weekly challenges" subtitle="Bigger goals that reset every Monday" />
            <QuestList quests={quests.filter((q) => q.cadence === "weekly")} compact />
          </Card>
        </div>
      ) : null}

      <Card id="achievements">
        <CardHeader title="Achievements" subtitle={`${earned} unlocked · bonuses are one-time XP rewards`} />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 @4xl:grid-cols-5">
          {achievements.map((a) => (
            <li key={a.id} className={cn("relative flex flex-col items-center rounded-[22px] border p-4 text-center", a.earned_at ? "border-line bg-ink-900/60" : "border-dashed border-line bg-transparent")}>
              <span className={cn("relative inline-flex size-16 items-center justify-center rounded-full", a.earned_at ? `bg-gradient-to-br ${TIER[a.tier]} text-ink-950 shadow-lg` : "bg-ink-900 text-fg-3")}>
                {a.earned_at ? <NamedIcon name={a.icon} className="size-7" /> : <Lock className="size-6" aria-hidden />}
              </span>
              <p className="mt-3 text-sm font-semibold leading-tight">{a.title}</p>
              <p className="mt-1 text-[11px] leading-snug text-fg-3">{a.description}</p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-fg-3">
                {a.earned_at ? `Earned ${fmtDate(a.earned_at)}` : `${a.tier} · +${a.xp_bonus} XP`}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-5 @4xl:grid-cols-12">
        <Card className="@4xl:col-span-7">
          <CardHeader icon={<Crown className="size-5 text-sun-300" />} title="Cosmetic unlocks" subtitle="Profile frames unlocked by level. They're just for fun — no advantages." />
          <FramePicker frames={PROFILE_FRAMES.map((f) => ({ id: f.id, label: f.label, level: f.level }))} current={me.profileFrame ?? "none"} level={level.level} name={actor.displayName} hue={user.avatar_hue} />
        </Card>
        <Card className="@4xl:col-span-5">
          <CardHeader title="School leaderboard" subtitle="Opt-in only · XP only · first name and initial" />
          {!settings.leaderboardEnabled ? (
            <Notice tone="info">Your school has not enabled the leaderboard.</Notice>
          ) : board.length ? (
            <ol className="space-y-2">
              {board.map((b, i) => (
                <li key={b.id} className={cn("flex items-center gap-3 rounded-2xl px-3 py-2", b.id === actor.id ? "bg-sun-300/[0.1] ring-1 ring-sun-300/30" : "")}>
                  <span className="w-5 text-center text-xs font-bold tabular-nums text-fg-3">{i + 1}</span>
                  <Avatar name={b.name} hue={b.avatarHue} size={30} />
                  <span className="flex-1 truncate text-sm font-medium">{b.id === actor.id ? `${b.name} (you)` : b.name}</span>
                  <span className="text-sm font-semibold tabular-nums text-sun-200">{b.xp.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-fg-3">No one has opted in yet.</p>
          )}
          <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-fg-3">
            <ShieldCheck className="size-3.5" aria-hidden /> {me.showOnLeaderboard ? "You're visible on the leaderboard." : "You're hidden."} Change this in Settings. Grades and other private data are never shown.
          </p>
        </Card>
      </div>
    </div>
  );
}
