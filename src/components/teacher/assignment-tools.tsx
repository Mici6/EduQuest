"use client";

import { useState, useTransition } from "react";
import { MessageSquareReply, Plus } from "lucide-react";
import { createAssignmentAction, returnSubmissionAction } from "@/actions/teacher";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

type Pair = { class_id: string; class_name: string; subject_id: string; subject_name: string };

export function NewAssignmentButton({ pairs, preset }: { pairs: Pair[]; preset?: { title: string; description: string } | null }) {
  const toast = useToast();
  const [open, setOpen] = useState(!!preset);
  const [pair, setPair] = useState(pairs[0] ? `${pairs[0].class_id}|${pairs[0].subject_id}` : "");
  const [title, setTitle] = useState(preset?.title ?? "");
  const [description, setDescription] = useState(preset?.description ?? "");
  const [due, setDue] = useState(() => {
    const d = new Date(Date.now() + 7 * 86400000);
    d.setHours(23, 59, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const [classId, subjectId] = pair.split("|");
      const res = await createAssignmentAction({ classId: classId!, subjectId: subjectId!, title, description, dueAt: new Date(due).toISOString(), origin: preset ? "ai_reviewed" : "manual" });
      if (!res.ok) return toast({ tone: "error", title: "Couldn't create", body: res.error });
      toast({ tone: "success", title: "Assignment published", body: "Students in the class have been notified." });
      setOpen(false);
      setTitle("");
      setDescription("");
    });
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> New assignment
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={preset ? "Review generated homework" : "New assignment"}
        description={preset ? "Generated from a lesson summary. Edit anything before publishing — nothing is sent until you do." : "Students are notified when you publish."}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={pending} disabled={!title.trim() || !description.trim() || !pair}>
              Publish
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Class & subject" htmlFor="as-pair">
            <Select id="as-pair" value={pair} onChange={(e) => setPair(e.target.value)}>
              {pairs.map((p) => (
                <option key={`${p.class_id}|${p.subject_id}`} value={`${p.class_id}|${p.subject_id}`}>
                  {p.class_name} · {p.subject_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title" htmlFor="as-title">
            <Input id="as-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
          </Field>
          <Field label="Instructions" htmlFor="as-desc">
            <Textarea id="as-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={7} maxLength={5000} />
          </Field>
          <Field label="Due" htmlFor="as-due">
            <Input id="as-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

export function ReturnSubmissionButton({ submissionId, studentName, body, fileName }: { submissionId: string; studentName: string; body: string | null; fileName: string | null }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const res = await returnSubmissionAction(submissionId, feedback);
      if (!res.ok) return toast({ tone: "error", title: "Couldn't return", body: res.error });
      toast({ tone: "success", title: `Feedback sent to ${studentName}` });
      setOpen(false);
    });
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <MessageSquareReply /> Review
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Submission · ${studentName}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={pending} disabled={!feedback.trim()}>
              Return with feedback
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-ink-900/60 p-4 text-sm">
            <p className="whitespace-pre-wrap">{body || "No written answer."}</p>
            {fileName ? <p className="mt-2 text-xs text-fg-3">Attachment: {fileName}</p> : null}
          </div>
          <Field label="Feedback" htmlFor="fb">
            <Textarea id="fb" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={5} placeholder="What went well, and one thing to improve…" maxLength={4000} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
