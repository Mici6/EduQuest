"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarClock, CircleCheck, FileText, MessageSquareQuote, Paperclip, Upload } from "lucide-react";
import { submitHomeworkFormAction } from "@/actions/student";
import { Badge, SubjectTag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { PillTabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { cn, fmtDateTime, relativeTime } from "@/lib/utils/format";

export type HomeworkItem = {
  id: string;
  title: string;
  description: string;
  due_at: string;
  subject_name: string;
  subject_color: string;
  teacher_name: string;
  submitted_at: string | null;
  feedback: string | null;
  body: string | null;
  file_name: string | null;
  state: "submitted" | "returned" | "overdue" | "due_soon" | "open";
};

type Filter = "todo" | "submitted" | "returned" | "all";

const STATE_BADGE: Record<HomeworkItem["state"], { tone: "rose" | "ember" | "neutral" | "mint" | "iris"; label: string }> = {
  overdue: { tone: "rose", label: "Overdue" },
  due_soon: { tone: "ember", label: "Due soon" },
  open: { tone: "neutral", label: "To do" },
  submitted: { tone: "iris", label: "Submitted" },
  returned: { tone: "mint", label: "Feedback ready" },
};

export function HomeworkBoard({ items, initialOpen }: { items: HomeworkItem[]; initialOpen: string | null }) {
  const [filter, setFilter] = useState<Filter>("todo");
  const [openId, setOpenId] = useState<string | null>(initialOpen);
  const counts = useMemo(
    () => ({
      todo: items.filter((i) => ["open", "due_soon", "overdue"].includes(i.state)).length,
      submitted: items.filter((i) => i.state === "submitted").length,
      returned: items.filter((i) => i.state === "returned").length,
      all: items.length,
    }),
    [items],
  );
  const shown = items.filter((i) => (filter === "all" ? true : filter === "todo" ? ["open", "due_soon", "overdue"].includes(i.state) : i.state === filter));
  const open = items.find((i) => i.id === openId) ?? null;

  return (
    <>
      <PillTabs
        label="Filter homework"
        className="mb-5"
        value={filter}
        onChange={setFilter}
        items={[
          { value: "todo", label: "To do", count: counts.todo },
          { value: "submitted", label: "Submitted", count: counts.submitted },
          { value: "returned", label: "Feedback", count: counts.returned },
          { value: "all", label: "All", count: counts.all },
        ]}
      />
      {shown.length ? (
        <ul className="grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
          {shown.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => setOpenId(h.id)}
                className="surface flex h-full w-full flex-col rounded-[22px] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-line-strong"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <SubjectTag name={h.subject_name} color={h.subject_color} />
                  <Badge tone={STATE_BADGE[h.state].tone}>{STATE_BADGE[h.state].label}</Badge>
                </div>
                <p className="mt-3 font-display text-base font-semibold leading-snug">{h.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-fg-3">{h.description}</p>
                <div className="mt-auto flex items-center gap-1.5 pt-4 text-xs text-fg-2">
                  <CalendarClock className="size-3.5" aria-hidden />
                  {h.state === "submitted" || h.state === "returned" ? `Handed in ${relativeTime(h.submitted_at!)}` : `Due ${relativeTime(h.due_at)}`}
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<CircleCheck />} title={filter === "todo" ? "Nothing to hand in" : "Nothing here yet"}>
          {filter === "todo" ? "You're all caught up. New homework from your teachers will appear here." : "Try a different filter."}
        </EmptyState>
      )}
      {open ? <HomeworkDialog key={open.id} item={open} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}

function HomeworkDialog({ item, onClose }: { item: HomeworkItem; onClose: () => void }) {
  const toast = useToast();
  const [body, setBody] = useState(item.body && item.body !== "Submitted via EduQuest (demo)." ? item.body : "");
  const [file, setFile] = useState<File | null>(null);
  const [pending, start] = useTransition();
  const locked = item.state === "returned";
  const submit = () => {
    const fd = new FormData();
    fd.set("assignmentId", item.id);
    fd.set("body", body);
    if (file) fd.set("file", file);
    start(async () => {
      const res = await submitHomeworkFormAction(fd);
      if (!res.ok) return toast({ tone: "error", title: "Submission failed", body: res.error });
      onClose();
      toast(
        res.data.xp
          ? { tone: "reward", title: `Submitted! +${res.data.xp} XP`, body: "Your teacher can now review your work." }
          : { tone: "success", title: res.data.resubmitted ? "Submission updated" : "Submitted", body: "Your teacher can now review your work." },
      );
    });
  };
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={item.title}
      description={`${item.subject_name} · ${item.teacher_name} · due ${fmtDateTime(item.due_at)}`}
      footer={
        locked ? (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} loading={pending} disabled={!body.trim() && !file && !item.file_name}>
              <Upload /> {item.submitted_at ? "Update submission" : "Hand in"}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-line bg-ink-900/60 p-4">
          <p className="mb-1 text-xs font-semibold text-fg-3">Instructions</p>
          <p className="whitespace-pre-line text-sm leading-relaxed">{item.description}</p>
        </div>
        {item.feedback ? (
          <div className="rounded-2xl border border-mint/30 bg-mint/[0.07] p-4">
            <p className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold text-mint">
              <MessageSquareQuote className="size-3.5" aria-hidden /> Feedback from {item.teacher_name}
            </p>
            <p className="text-sm leading-relaxed">{item.feedback}</p>
          </div>
        ) : null}
        {item.submitted_at ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-fg-2">
            <CircleCheck className="size-3.5 text-mint" aria-hidden /> Handed in {fmtDateTime(item.submitted_at)}
            {item.file_name ? (
              <span className="inline-flex items-center gap-1 text-fg-3">
                · <FileText className="size-3.5" aria-hidden /> {item.file_name}
              </span>
            ) : null}
          </p>
        ) : null}
        {locked ? null : (
          <>
            <Field label="Your answer" htmlFor="hw-body" hint="Explain your reasoning — your teacher reads this together with any attachment.">
              <Textarea id="hw-body" value={body} onChange={(e) => setBody(e.target.value)} rows={7} placeholder="Type your answer or notes for your teacher…" maxLength={20000} />
            </Field>
            <div>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed px-4 py-3.5 text-sm transition-colors",
                  file ? "border-sun-300/50 bg-sun-300/[0.06]" : "border-line-strong hover:border-sun-300/40",
                )}
              >
                <Paperclip className="size-4 shrink-0 text-fg-3" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{file ? file.name : "Attach a photo, PDF, DOCX or text file (optional, max 10 MB)"}</span>
                <input type="file" className="sr-only" accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
