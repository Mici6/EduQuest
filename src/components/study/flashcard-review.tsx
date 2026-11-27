"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, Check, Keyboard, RotateCcw, Shuffle, Sparkles, X } from "lucide-react";
import { refreshAction, reviewCardAction } from "@/actions/student";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { PillTabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/format";

type CardT = { id: string; front: string; back: string; box: number | null; due_on: string | null };

const BOX_LABEL = ["New", "Learning", "Familiar", "Strong", "Mastered", "Mastered"];

export function FlashcardReview({ cards, today, title }: { cards: CardT[]; today: string; title: string }) {
  const toast = useToast();
  const [mode, setMode] = useState<"due" | "all">(cards.some((c) => !c.due_on || c.due_on <= today) ? "due" : "all");
  const [order, setOrder] = useState<string[]>(() => cards.map((c) => c.id));
  const [boxes, setBoxes] = useState<Record<string, number>>(() => Object.fromEntries(cards.map((c) => [c.id, c.box ?? 0])));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ correct: 0, incorrect: 0, xp: 0 });
  const [, start] = useTransition();

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const queue = useMemo(() => order.filter((id) => mode === "all" || !byId.get(id)!.due_on || byId.get(id)!.due_on! <= today), [order, mode, byId, today]);
  const current = queue[index] ? byId.get(queue[index]!) : undefined;
  const finished = index >= queue.length;

  const answer = useCallback(
    (correct: boolean) => {
      if (!current) return;
      const id = current.id;
      setStats((s) => ({ ...s, correct: s.correct + (correct ? 1 : 0), incorrect: s.incorrect + (correct ? 0 : 1) }));
      setBoxes((b) => ({ ...b, [id]: correct ? Math.min(5, (b[id] ?? 0) + 1) : 1 }));
      setFlipped(false);
      setIndex((i) => i + 1);
      start(async () => {
        const res = await reviewCardAction(id, correct);
        if (!res.ok) toast({ tone: "error", title: "Progress not saved", body: res.error });
        else if (res.data.xp) setStats((s) => ({ ...s, xp: s.xp + res.data.xp }));
      });
    },
    [current, toast],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && (e.key === "1" || e.key === "ArrowLeft")) answer(false);
      else if (flipped && (e.key === "2" || e.key === "ArrowRight")) answer(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, finished, flipped]);

  const restart = (m = mode) => {
    setMode(m);
    setIndex(0);
    setFlipped(false);
    setStats({ correct: 0, incorrect: 0, xp: 0 });
  };

  const mastered = Object.values(boxes).filter((b) => b >= 4).length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/flashcards" className="inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg">
          <ArrowLeft className="size-4" /> All sets
        </Link>
        <div className="flex items-center gap-2">
          <PillTabs
            label="Cards to review"
            size="sm"
            value={mode}
            onChange={(m) => restart(m)}
            items={[
              { value: "due", label: "Due", count: cards.filter((c) => !c.due_on || c.due_on <= today).length },
              { value: "all", label: "All", count: cards.length },
            ]}
          />
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label="Shuffle cards"
            onClick={() => {
              setOrder((o) => [...o].sort(() => Math.random() - 0.5));
              restart();
            }}
          >
            <Shuffle />
          </Button>
        </div>
      </div>

      {finished ? (
        <div className="surface animate-fade-up rounded-[var(--radius-card)] p-8 text-center">
          <ProgressRing value={queue.length ? stats.correct / Math.max(1, stats.correct + stats.incorrect) : 1} size={120} stroke={10} tone="mint" className="mx-auto">
            <div>
              <p className="font-display text-2xl font-semibold">{stats.correct}</p>
              <p className="text-[10px] text-fg-3">known</p>
            </div>
          </ProgressRing>
          <h2 className="mt-5 font-display text-2xl font-semibold">{queue.length ? "Session complete!" : "Nothing due right now"}</h2>
          <p className="mt-2 text-sm text-fg-2">
            {queue.length
              ? `You reviewed ${stats.correct + stats.incorrect} cards. Cards you knew come back later; the others will reappear soon.`
              : "All cards in this set are scheduled for later. Review everything anyway, or come back tomorrow."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {stats.xp ? (
              <Badge tone="sun" icon={<Sparkles />}>
                +{stats.xp} XP
              </Badge>
            ) : null}
            <Badge tone="mint">{mastered} of {cards.length} mastered</Badge>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={() => restart("all")}>
              <RotateCcw /> Review all cards
            </Button>
            <ButtonLink href="/app/flashcards" variant="secondary" onClick={() => void refreshAction()}>
              Done
            </ButtonLink>
          </div>
        </div>
      ) : current ? (
        <>
          <div className="mb-3 flex items-center gap-3 text-xs text-fg-3">
            <span className="tabular-nums">
              {index + 1} / {queue.length}
            </span>
            <ProgressBar value={index / queue.length} size="sm" label={`${title} progress`} />
            <Badge tone={boxes[current.id]! >= 4 ? "mint" : boxes[current.id]! >= 2 ? "iris" : "neutral"}>{BOX_LABEL[boxes[current.id] ?? 0]}</Badge>
          </div>
          <div className="flip-scene">
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="flip-card relative block h-80 w-full text-left sm:h-96"
              data-flipped={flipped}
              aria-label={flipped ? "Showing answer. Activate to show the question." : "Showing question. Activate to reveal the answer."}
            >
              <div className="flip-face surface absolute inset-0 flex flex-col rounded-[var(--radius-card)] p-6 sm:p-8">
                <span className="text-xs font-semibold uppercase tracking-wider text-sun-300">Question</span>
                <p className="m-auto text-center font-display text-xl font-semibold leading-snug sm:text-2xl">{current.front}</p>
                <span className="text-center text-xs text-fg-3">Tap or press Space to reveal</span>
              </div>
              <div className="flip-face flip-back grad-sun absolute inset-0 flex flex-col rounded-[var(--radius-card)] p-6 text-ink-950 sm:p-8">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-950/60">Answer</span>
                <p className="m-auto text-center text-lg font-medium leading-relaxed sm:text-xl">{current.back}</p>
                <span className="text-center text-xs text-ink-950/60">Did you know it?</span>
              </div>
            </button>
          </div>
          <div className={cn("mt-5 grid grid-cols-2 gap-3 transition-opacity", flipped ? "opacity-100" : "pointer-events-none opacity-40")} aria-hidden={!flipped}>
            <Button variant="danger" size="lg" onClick={() => answer(false)} disabled={!flipped}>
              <X /> Still learning
            </Button>
            <Button size="lg" onClick={() => answer(true)} disabled={!flipped} className="!bg-mint hover:!bg-mint/90">
              <Check /> Got it
            </Button>
          </div>
          <p className="mt-4 hidden items-center justify-center gap-1.5 text-xs text-fg-3 sm:flex">
            <Keyboard className="size-3.5" aria-hidden /> Space to flip · 1 still learning · 2 got it
          </p>
        </>
      ) : null}
    </div>
  );
}
