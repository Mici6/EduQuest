"use client";

import { useState, useTransition } from "react";
import { BookOpenCheck, Check, Clock, Hand, Layers, ListChecks, MessagesSquare, NotebookPen, Timer } from "lucide-react";
import { claimQuestAction, logStudyAction } from "@/actions/student";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/form";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/format";
import { celebrations } from "./celebrate";

export type QuestItem = {
  id: string;
  cadence: "daily" | "weekly";
  metric: string;
  title: string;
  description: string;
  target: number;
  xp_reward: number;
  difficulty: "easy" | "medium" | "hard";
  progress: number;
  completed_at: string | null;
  claimed_at: string | null;
};

const METRIC_ICON: Record<string, typeof ListChecks> = {
  quiz_completed: ListChecks,
  flashcards_reviewed: Layers,
  study_minutes: Timer,
  assignment_submitted: NotebookPen,
  volunteering_verified: Hand,
  ai_session: MessagesSquare,
};

const METRIC_HREF: Record<string, string> = {
  quiz_completed: "/app/quizzes",
  flashcards_reviewed: "/app/flashcards",
  assignment_submitted: "/app/homework",
  volunteering_verified: "/app/volunteering",
  ai_session: "/app/study/chat",
};

export function QuestList({ quests, compact }: { quests: QuestItem[]; compact?: boolean }) {
  const toast = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, start] = useTransition();
  const [logOpen, setLogOpen] = useState(false);

  const claim = (q: QuestItem) => {
    setPendingId(q.id);
    start(async () => {
      const res = await claimQuestAction(q.id);
      setPendingId(null);
      if (!res.ok) return toast({ tone: "error", title: "Couldn't claim quest", body: res.error });
      toast({ tone: "reward", title: `+${res.data.xp} XP`, body: `Quest complete: ${q.title}` });
      for (const c of celebrations(res.data.before, res.data.after)) toast({ tone: "reward", ...c });
    });
  };

  return (
    <>
      <ul className="space-y-2.5">
        {quests.map((q) => {
          const Icon = METRIC_ICON[q.metric] ?? BookOpenCheck;
          const done = !!q.completed_at;
          const claimed = !!q.claimed_at;
          return (
            <li
              key={q.id}
              className={cn(
                "flex items-center gap-3 rounded-[20px] border p-3 transition-colors sm:gap-4 sm:p-3.5",
                claimed ? "border-line/60 bg-ink-900/40 opacity-70" : done ? "border-sun-300/40 bg-sun-300/[0.07]" : "border-line bg-ink-900/60",
              )}
            >
              <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-2xl", done ? "bg-sun-200 text-ink-950" : "bg-white/[0.06] text-fg-2")}>
                {claimed ? <Check className="size-5" aria-hidden /> : <Icon className="size-5" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className={cn("text-sm font-semibold", claimed && "line-through decoration-fg-3")}>{q.title}</p>
                  {!compact ? <Badge tone={q.difficulty === "hard" ? "ember" : q.difficulty === "medium" ? "iris" : "neutral"}>{q.difficulty}</Badge> : null}
                </div>
                {!compact ? <p className="mt-0.5 truncate text-xs text-fg-3">{q.description}</p> : null}
                <div className="mt-2 flex items-center gap-3">
                  <ProgressBar value={q.progress / q.target} size="sm" tone={done ? "ember" : "sun"} label={`${q.title} progress`} />
                  <span className="shrink-0 text-[11px] tabular-nums text-fg-3">
                    {Math.min(q.progress, q.target)}/{q.target}
                  </span>
                </div>
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-fg-3">
                  <Clock className="size-3" aria-hidden /> {q.cadence === "daily" ? "Resets at midnight" : "Resets on Monday"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="text-xs font-bold text-sun-200">+{q.xp_reward} XP</span>
                {claimed ? (
                  <span className="text-[11px] font-semibold text-fg-3">Claimed</span>
                ) : done ? (
                  <Button size="sm" onClick={() => claim(q)} loading={pendingId === q.id}>
                    Claim
                  </Button>
                ) : q.metric === "study_minutes" ? (
                  <Button size="sm" variant="secondary" onClick={() => setLogOpen(true)}>
                    Log time
                  </Button>
                ) : METRIC_HREF[q.metric] ? (
                  <a href={METRIC_HREF[q.metric]} className="text-[11px] font-semibold text-fg-2 underline-offset-2 hover:text-fg hover:underline">
                    Start
                  </a>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <StudyLogDialog open={logOpen} onClose={() => setLogOpen(false)} />
    </>
  );
}

export function StudyLogDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [minutes, setMinutes] = useState(25);
  const [activity, setActivity] = useState("Revision");
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const res = await logStudyAction(minutes, activity);
      if (!res.ok) return toast({ tone: "error", title: "Couldn't log session", body: res.error });
      onClose();
      toast({
        tone: res.data.xp ? "reward" : "success",
        title: res.data.xp ? `+${res.data.xp} XP for focused study` : "Study session logged",
        body: res.data.capped ? "You've reached today's XP limit for study time — great work, now take a proper break!" : "Remember to take a short break.",
      });
      for (const c of celebrations(res.data.before, res.data.after)) toast({ tone: "reward", ...c });
    });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Log a focused study session"
      description="Record time you spent studying away from distractions. Study-time XP is capped each day to encourage healthy habits."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={pending}>
            Log session
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Duration" htmlFor="study-min">
          <Select id="study-min" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {[10, 15, 20, 25, 30, 45, 60, 90].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </Select>
        </Field>
        <Field label="What did you work on?" htmlFor="study-act">
          <Select id="study-act" value={activity} onChange={(e) => setActivity(e.target.value)}>
            {["Revision", "Reading", "Homework", "Practice problems", "Group study", "Project work"].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}

export function LogStudyButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Timer /> Log study time
      </Button>
      <StudyLogDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
