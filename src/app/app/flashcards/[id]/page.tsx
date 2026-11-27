import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashcardReview } from "@/components/study/flashcard-review";
import { OriginBadge } from "@/components/ui/ai-badge";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { DomainError } from "@/lib/auth/errors";
import { getDb } from "@/lib/db";
import { getFlashcardSet } from "@/lib/domain/study";
import { isoDate } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Review flashcards" };

export default async function FlashcardSetPage({ params }: PageProps<"/app/flashcards/[id]">) {
  const actor = await requireActor(["student", "teacher"]);
  const { id } = await params;
  let data;
  try {
    data = getFlashcardSet(getDb(), actor, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  return (
    <div>
      <PageHeader eyebrow={data.set.subject_name ?? "Flashcards"} title={data.set.title} description={data.set.description ?? undefined} actions={<OriginBadge origin={data.set.origin} />} />
      <FlashcardReview cards={data.cards.map((c) => ({ id: c.id, front: c.front, back: c.back, box: c.box, due_on: c.due_on }))} today={isoDate()} title={data.set.title} />
    </div>
  );
}
