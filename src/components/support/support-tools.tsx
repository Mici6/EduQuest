"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CircleCheck, CircleX, ClipboardPlus, RefreshCw, Send } from "lucide-react";
import { addPlanNoteAction, createPlanAction, reviewIndicatorAction, runDetectionAction, setPlanStatusAction } from "@/actions/support";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export function RunDetectionButton() {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      onClick={() =>
        start(async () => {
          const res = await runDetectionAction();
          toast(res.ok ? { tone: "info", title: res.data ? `${res.data} new indicator${res.data === 1 ? "" : "s"} for review` : "No new patterns detected" } : { tone: "error", title: "Couldn't run", body: res.error });
        })
      }
      loading={pending}
    >
      <RefreshCw /> Run pattern check
    </Button>
  );
}

export function ReviewForm({ indicatorId }: { indicatorId: string }) {
  const toast = useToast();
  const [rationale, setRationale] = useState("");
  const [pending, start] = useTransition();
  const decide = (decision: "confirmed" | "dismissed") =>
    start(async () => {
      const res = await reviewIndicatorAction(indicatorId, decision, rationale);
      toast(res.ok ? { tone: "success", title: decision === "confirmed" ? "Confirmed — you can now create a support plan" : "Dismissed", body: "Your decision and rationale were recorded." } : { tone: "error", title: "Not saved", body: res.error });
    });
  return (
    <div className="space-y-4">
      <Field label="Rationale (required)" htmlFor="rv-r" hint="Record what you checked — e.g. a conversation with the student or homeroom teacher. Avoid unnecessary personal details.">
        <Textarea id="rv-r" rows={4} value={rationale} onChange={(e) => setRationale(e.target.value)} maxLength={2000} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => decide("confirmed")} loading={pending} disabled={rationale.trim().length < 10}>
          <CircleCheck /> Confirm: support may help
        </Button>
        <Button variant="secondary" onClick={() => decide("dismissed")} disabled={pending || rationale.trim().length < 10}>
          <CircleX /> Dismiss
        </Button>
      </div>
    </div>
  );
}

export function CreatePlanButton({ studentId, indicatorId, studentName }: { studentId: string; indicatorId: string | null; studentName: string }) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [goals, setGoals] = useState("");
  const [actions, setActions] = useState("");
  const [reviewOn, setReviewOn] = useState(() => new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10));
  const [pending, start] = useTransition();
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <ClipboardPlus /> Create support plan
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={`Support plan · ${studentName}`}
        description="Agree goals and supportive actions with the student (and family where appropriate). Plans are visible only to authorised support staff."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                start(async () => {
                  const res = await createPlanAction({ studentId, indicatorId, goals, actions, reviewOn });
                  if (!res.ok) return toast({ tone: "error", title: "Plan not created", body: res.error });
                  toast({ tone: "success", title: "Support plan created" });
                  setOpen(false);
                  router.push(`/app/support/plans/${res.data}`);
                })
              }
            >
              Create plan
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Goals" htmlFor="pl-g" hint="Positive, specific and agreed with the student.">
            <Textarea id="pl-g" rows={3} value={goals} onChange={(e) => setGoals(e.target.value)} maxLength={3000} />
          </Field>
          <Field label="Supportive actions" htmlFor="pl-a" hint="Who does what — e.g. weekly check-in, catch-up materials, family contact.">
            <Textarea id="pl-a" rows={4} value={actions} onChange={(e) => setActions(e.target.value)} maxLength={3000} />
          </Field>
          <Field label="Review date" htmlFor="pl-r">
            <Input id="pl-r" type="date" value={reviewOn} onChange={(e) => setReviewOn(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

export function NoteComposer({ planId }: { planId: string }) {
  const toast = useToast();
  const [kind, setKind] = useState<"note" | "follow_up" | "progress_review">("follow_up");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <Field label="Type" htmlFor="nt-k">
        <Select id="nt-k" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="follow_up">Follow-up</option>
          <option value="progress_review">Progress review</option>
          <option value="note">Note</option>
        </Select>
      </Field>
      <Field label="Note" htmlFor="nt-b" hint="Factual and minimal. Notes are retained only until the plan's retention date.">
        <Textarea id="nt-b" rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
      </Field>
      <Button
        loading={pending}
        disabled={body.trim().length < 3}
        onClick={() =>
          start(async () => {
            const res = await addPlanNoteAction(planId, kind, body);
            if (!res.ok) return toast({ tone: "error", title: "Not saved", body: res.error });
            setBody("");
            toast({ tone: "success", title: "Note added" });
          })
        }
      >
        <Send /> Add to timeline
      </Button>
    </div>
  );
}

export function PlanStatusSelect({ planId, status }: { planId: string; status: string }) {
  const toast = useToast();
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="plan-status" className="text-xs font-semibold text-fg-2">
        Status
      </label>
      <Select
        id="plan-status"
        value={value}
        disabled={pending}
        className="!h-9 w-40 !rounded-full text-xs"
        onChange={(e) => {
          const next = e.target.value as "active" | "monitoring" | "closed";
          setValue(next);
          start(async () => {
            const res = await setPlanStatusAction(planId, next);
            toast(res.ok ? { tone: "success", title: `Plan marked ${next}` } : { tone: "error", title: "Not updated", body: res.error });
          });
        }}
      >
        <option value="active">Active</option>
        <option value="monitoring">Monitoring</option>
        <option value="closed">Closed</option>
      </Select>
    </div>
  );
}
