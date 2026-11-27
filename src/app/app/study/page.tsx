import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BookOpenCheck, CalendarCheck, Layers, LibraryBig, Lightbulb, ListChecks, MessagesSquare, ScanText, Sparkles, Timer } from "lucide-react";
import { SnowLeopard } from "@/components/companion/snow-leopard";
import { AiStatusNotice } from "@/components/study/ai-status";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { requireActor } from "@/lib/auth/current";
import { publicConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { schoolSettings } from "@/lib/domain/admin";
import { aiUsageToday, listConversations } from "@/lib/domain/ai-service";
import { revisionSuggestions } from "@/lib/domain/recommendations";
import { cn, relativeTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "AI Study" };

const TOOLS = [
  { href: "/app/study/summary", title: "Summaries", body: "Concise notes, chapter summaries and revision sheets", icon: BookOpenCheck, cls: "bg-sun-100 text-ink-950" },
  { href: "/app/flashcards", title: "Flashcards", body: "Spaced-repetition cards from any lesson", icon: Layers, cls: "grad-sun text-ink-950" },
  { href: "/app/study/quiz", title: "Quiz generator", body: "Multiple choice, true/false and short answer", icon: ListChecks, cls: "bg-ember text-ink-950" },
  { href: "/app/study/quiz?kind=practice_test", title: "Practice tests", body: "Timed or untimed revision tests", icon: Timer, cls: "bg-amber text-ink-950" },
  { href: "/app/study/homework", title: "Homework helper", body: "Guided steps — paste, photo or PDF", icon: ScanText, cls: "bg-iris-200 text-ink-950" },
  { href: "/app/study/plan", title: "Study plan", body: "A gentle plan for the days ahead", icon: CalendarCheck, cls: "bg-mint text-ink-950" },
] as const;

export default async function StudyHub() {
  const actor = await requireActor(["student"]);
  const db = getDb();
  const cfg = publicConfig();
  const limit = schoolSettings(db, actor.schoolId).aiDailyLimit;
  const used = aiUsageToday(db, actor);
  const conversations = listConversations(db, actor).slice(0, 5);
  const suggestions = revisionSuggestions(db, actor);

  return (
    <div>
      <PageHeader eyebrow="AI Study" title="Study smarter, not longer" description="Tools that work from your teachers' lesson materials and your own notes. They explain and guide — the learning stays yours." />
      <AiStatusNotice mode={cfg.aiMode} model={cfg.aiModel} className="mb-5" />

      <div className="grid gap-4 @4xl:grid-cols-12">
        <Link href="/app/study/chat" className="grad-iris group relative overflow-hidden rounded-[var(--radius-card)] p-6 text-ink-950 @4xl:col-span-5 @4xl:p-7">
          <div className="absolute -right-10 -top-10 size-48 rounded-full bg-white/20 blur-2xl" aria-hidden />
          <div className="absolute -bottom-12 -right-12 size-48 rounded-full border-[22px] border-ink-950/[0.07]" aria-hidden />
          <SnowLeopard paw className="absolute -bottom-3 right-2 size-32 opacity-95 transition-transform duration-200 ease-out group-hover:-translate-y-1 sm:size-36" />
          <span className="relative inline-flex items-center gap-1.5 rounded-full bg-ink-950/15 px-3 py-1 text-xs font-semibold">
            <MessagesSquare className="size-3.5" aria-hidden /> AI tutor
          </span>
          <h2 className="relative mt-5 font-display text-3xl font-semibold">Study with Irbis</h2>
          <p className="relative mt-2 max-w-[60%] text-sm text-ink-950/75">Ask anything about your lessons. Irbis cites your materials and clearly marks anything beyond them.</p>
          <span className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-fg transition-transform group-hover:translate-x-1">
            Start a conversation <ArrowUpRight className="size-4" aria-hidden />
          </span>
        </Link>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 @4xl:col-span-7">
          {TOOLS.map((t) => (
            <Link key={t.href} href={t.href} className={cn("group relative flex min-h-36 flex-col justify-between gap-4 overflow-hidden rounded-[26px] p-4 transition-transform hover:-translate-y-0.5 sm:p-5", t.cls)}>
              <div className="flex items-start justify-between">
                <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-ink-950/10">
                  <t.icon className="size-5" aria-hidden />
                </span>
                <ArrowUpRight className="size-5 opacity-60 transition-opacity group-hover:opacity-100" aria-hidden />
              </div>
              <div>
                <p className="font-display text-base font-semibold sm:text-lg">{t.title}</p>
                <p className="text-xs text-ink-950/70">{t.body}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-5 @4xl:grid-cols-12">
        <Card className="@4xl:col-span-7">
          <CardHeader icon={<Lightbulb className="size-5 text-sun-300" />} title="Suggested revision" subtitle="Based on your recent grades — suggestions, not assessments" />
          <ul className="space-y-3">
            {suggestions.map((s) => (
              <li key={s.subjectId} className="rounded-2xl border border-line bg-ink-900/60 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="size-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
                  {s.subject}
                </p>
                <p className="mt-1 text-xs text-fg-3">{s.reason}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.doc ? (
                    <Link href={`/app/study/summary?doc=${s.doc.id}`} className="rounded-full bg-ink-700 px-3 py-1.5 text-xs font-semibold hover:bg-ink-750">
                      Summary: {s.doc.title}
                    </Link>
                  ) : null}
                  {s.set ? (
                    <Link href={`/app/flashcards/${s.set.id}`} className="rounded-full bg-ink-700 px-3 py-1.5 text-xs font-semibold hover:bg-ink-750">
                      Flashcards: {s.set.title}
                    </Link>
                  ) : null}
                  {s.quiz ? (
                    <Link href={`/app/quizzes/${s.quiz.id}`} className="rounded-full bg-ink-700 px-3 py-1.5 text-xs font-semibold hover:bg-ink-750">
                      Quiz: {s.quiz.title}
                    </Link>
                  ) : null}
                  {!s.doc && !s.set && !s.quiz ? (
                    <Link href={`/app/study/chat?q=${encodeURIComponent(`Help me revise ${s.subject}`)}`} className="rounded-full bg-ink-700 px-3 py-1.5 text-xs font-semibold hover:bg-ink-750">
                      Ask the tutor
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
            {!suggestions.length ? <li className="text-sm text-fg-3">Suggestions appear once you have some grades.</li> : null}
          </ul>
        </Card>
        <div className="space-y-5 @4xl:col-span-5">
          <Card>
            <CardHeader icon={<Sparkles className="size-5 text-iris-300" />} title="Today's AI usage" subtitle="Daily limits keep AI use healthy and fair" />
            <div className="mb-2 flex justify-between text-xs">
              <span className="text-fg-2">{used} requests used</span>
              <span className="text-fg-3">limit {limit}</span>
            </div>
            <ProgressBar value={limit ? used / limit : 1} tone="iris" label="AI requests used today" />
          </Card>
          <Card>
            <CardHeader
              title="Recent conversations"
              action={
                <Link href="/app/library" className="inline-flex items-center gap-1 text-xs font-semibold text-fg-2 hover:text-fg">
                  <LibraryBig className="size-3.5" /> Library
                </Link>
              }
            />
            {conversations.length ? (
              <ul className="space-y-1">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <Link href={`/app/study/chat?c=${c.id}`} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm hover:bg-white/[0.04]">
                      <span className="truncate">{c.title}</span>
                      <span className="shrink-0 text-[11px] text-fg-3">{relativeTime(c.updated_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-3">No conversations yet — ask your first question!</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
