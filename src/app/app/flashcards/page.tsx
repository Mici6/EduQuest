import type { Metadata } from "next";
import Link from "next/link";
import { Layers } from "lucide-react";
import { FlashcardsToolbar } from "@/components/study/flashcards-toolbar";
import { OriginBadge } from "@/components/ui/ai-badge";
import { Badge, SubjectTag } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { getAiMode } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { listDocuments } from "@/lib/domain/documents";
import { listFlashcardSets } from "@/lib/domain/study";

export const metadata: Metadata = { title: "Flashcards" };

export default async function FlashcardsPage({ searchParams }: PageProps<"/app/flashcards">) {
  const actor = await requireActor(["student"]);
  const sp = await searchParams;
  const db = getDb();
  const sets = listFlashcardSets(db, actor);
  const docs = listDocuments(db, actor).filter((d) => d.status === "indexed").map((d) => ({ id: d.id, title: d.title, subject_name: d.subject_name }));
  const due = sets.reduce((s, x) => s + x.due, 0);
  return (
    <div>
      <PageHeader
        eyebrow="AI Study"
        title="Flashcards"
        description={due ? `${due} cards are due for review today. Spaced repetition brings back the cards you find hardest more often.` : "You're up to date! Review any set to keep it fresh."}
        actions={<FlashcardsToolbar docs={docs} initialOpen={sp.generate === "1"} initialDocId={typeof sp.doc === "string" ? sp.doc : null} disabled={getAiMode() === "unavailable"} />}
      />
      {sets.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 @5xl:grid-cols-3">
          {sets.map((s) => (
            <li key={s.id}>
              <Link href={`/app/flashcards/${s.id}`} className="surface group flex h-full flex-col rounded-[var(--radius-card)] p-5 transition-all hover:-translate-y-0.5 hover:border-line-strong">
                <div className="flex items-start justify-between gap-2">
                  <span className="relative inline-flex size-12 items-center justify-center">
                    <span className="absolute inset-0 rotate-6 rounded-2xl bg-sun-300/25" aria-hidden />
                    <span className="relative inline-flex size-12 items-center justify-center rounded-2xl bg-sun-200 text-ink-950">
                      <Layers className="size-5" aria-hidden />
                    </span>
                  </span>
                  {s.due ? <Badge tone="ember">{s.due} due</Badge> : <Badge tone="mint">Up to date</Badge>}
                </div>
                <p className="mt-4 font-display text-lg font-semibold leading-snug">{s.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-fg-3">
                  {s.subject_name ? <SubjectTag name={s.subject_name} color={s.subject_color!} /> : null}
                  <span>{s.owner_id === actor.id ? "Your set" : `by ${s.owner_name}`}</span>
                </div>
                <div className="mt-auto pt-5">
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-fg-2">
                      {s.mastered}/{s.cards} mastered
                    </span>
                    <OriginBadge origin={s.origin} />
                  </div>
                  <ProgressBar value={s.cards ? s.mastered / s.cards : 0} tone="mint" size="sm" label={`${s.title} mastery`} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Layers />} title="No flashcard sets yet">
          Create a set from any lesson in your library.
        </EmptyState>
      )}
    </div>
  );
}
