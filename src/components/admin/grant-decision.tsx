"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { decideGrantAction } from "@/actions/ai-courses";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

/** Final decision on a teacher-recommended grant: approve (possibly a lower amount) or decline with a reason. */
export function GrantDecision({ id, recommended, max, currency }: { id: string; recommended: number; max: number; currency: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const cap = Math.min(recommended, max);
  const [amount, setAmount] = useState(String(cap));
  const [note, setNote] = useState("");
  const decide = (approve: boolean) =>
    start(async () => {
      const res = await decideGrantAction(id, { approve, amount: Number(amount) || 0, note });
      toast(res.ok ? { tone: "success", title: approve ? "Grant approved and reserved" : "Grant declined" } : { tone: "error", title: "Couldn't save the decision", body: res.error });
    });
  return (
    <div className="mt-3 grid gap-3 rounded-2xl border border-line bg-ink-900/60 p-3.5 sm:grid-cols-[140px_minmax(0,1fr)]">
      <Field label={`Amount (${currency})`} htmlFor={`gd-a-${id}`} hint={`Max ${cap}`}>
        <Input id={`gd-a-${id}`} type="number" inputMode="numeric" min={1} max={cap} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="Note to the student" htmlFor={`gd-n-${id}`} hint="Required when declining.">
        <Textarea id={`gd-n-${id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
      </Field>
      <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
        <Button size="sm" onClick={() => decide(true)} loading={pending} disabled={cap < 1}>
          <Check /> Approve
        </Button>
        <Button size="sm" variant="secondary" onClick={() => decide(false)} loading={pending} disabled={!note.trim()}>
          <X /> Decline
        </Button>
      </div>
    </div>
  );
}
