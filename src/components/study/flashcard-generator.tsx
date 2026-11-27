"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Save, Trash2, WandSparkles } from "lucide-react";
import { saveFlashcardSetAction } from "@/actions/ai";
import { generateFlashcards } from "@/lib/ai/browser";
import { OriginBadge } from "@/components/ui/ai-badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { SourcePicker, emptySource, sourceReady, sourceSpec, type DocOption } from "./source-picker";

type Card = { front: string; back: string };

/** Generate → review/edit → save a flashcard set. Teachers' sets are saved as drafts. */
export function FlashcardGenerator({
  docs,
  initialDocId,
  open,
  onClose,
  role,
  disabled,
}: {
  docs: DocOption[];
  initialDocId: string | null;
  open: boolean;
  onClose: () => void;
  role: "student" | "teacher";
  disabled: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [source, setSource] = useState(() => emptySource(docs, initialDocId));
  const [count, setCount] = useState(10);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [meta, setMeta] = useState<{ documentId: string | null; subjectId: string | null; simulated: boolean } | null>(null);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  const [saving, startSave] = useTransition();

  const generate = () =>
    start(async () => {
      const res = await generateFlashcards(sourceSpec(source), count);
      if (!res.ok) return toast({ tone: "error", title: "Couldn't create flashcards", body: res.error });
      setCards(res.data.cards);
      setMeta({ documentId: res.data.documentId, subjectId: res.data.subjectId, simulated: res.data.simulated });
      setTitle(`${res.data.sourceTitle} — flashcards`);
    });

  const save = () =>
    startSave(async () => {
      if (!cards || !meta) return;
      const res = await saveFlashcardSetAction({ title, cards, ...meta });
      if (!res.ok) return toast({ tone: "error", title: "Couldn't save", body: res.error });
      toast({ tone: "success", title: role === "teacher" ? "Saved as a draft" : "Flashcard set saved", body: role === "teacher" ? "Review it in AI Studio, then publish it to a class." : "Start reviewing now." });
      onClose();
      setCards(null);
      router.push(role === "teacher" ? "/app/teacher/studio?tab=drafts" : `/app/flashcards/${res.data}`);
    });

  const update = (i: number, patch: Partial<Card>) => setCards((cs) => cs!.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={cards ? "Review your flashcards" : "Create flashcards"}
      description={cards ? "Edit anything that isn't quite right before saving." : "Generate cards from lesson material, a topic or your own notes."}
      footer={
        cards ? (
          <>
            <Button variant="ghost" onClick={() => setCards(null)}>
              Back
            </Button>
            <Button onClick={save} loading={saving} disabled={!title.trim() || !cards.some((c) => c.front.trim() && c.back.trim())}>
              <Save /> {role === "teacher" ? "Save draft" : "Save set"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={generate} loading={pending} disabled={disabled || !sourceReady(source)}>
              <WandSparkles /> Generate
            </Button>
          </>
        )
      }
    >
      {cards ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <OriginBadge origin={meta?.simulated ? "simulated" : "ai"} />
            <span className="text-xs text-fg-3">{cards.length} cards</span>
          </div>
          {role === "teacher" ? <Notice tone="info">Generated content is saved as a draft. Students only see it after you review and publish it.</Notice> : null}
          <Field label="Set title" htmlFor="fc-title">
            <Input id="fc-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </Field>
          <ol className="space-y-3">
            {cards.map((c, i) => (
              <li key={i} className="grid gap-2 rounded-2xl border border-line bg-ink-900/60 p-3 sm:grid-cols-[1fr_1.4fr_auto]">
                <label className="sr-only" htmlFor={`fc-f-${i}`}>
                  Card {i + 1} front
                </label>
                <Textarea id={`fc-f-${i}`} value={c.front} onChange={(e) => update(i, { front: e.target.value })} rows={2} className="min-h-0" />
                <label className="sr-only" htmlFor={`fc-b-${i}`}>
                  Card {i + 1} back
                </label>
                <Textarea id={`fc-b-${i}`} value={c.back} onChange={(e) => update(i, { back: e.target.value })} rows={2} className="min-h-0" />
                <Button variant="ghost" size="icon-sm" onClick={() => setCards((cs) => cs!.filter((_, j) => j !== i))} aria-label={`Remove card ${i + 1}`}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ol>
          <Button variant="secondary" size="sm" onClick={() => setCards((cs) => [...cs!, { front: "", back: "" }])}>
            <Plus /> Add card
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <SourcePicker docs={docs} value={source} onChange={setSource} />
          <Field label="Number of cards" htmlFor="fc-count">
            <Select id="fc-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[5, 8, 10, 15, 20].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}
    </Dialog>
  );
}
