"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, CalendarDays, Coins, Plus, UserRoundX, Users } from "lucide-react";
import { createActivityAction, verifyParticipationAction } from "@/actions/teacher";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { fmtDateTime } from "@/lib/utils/format";

type Reg = { id: string; display_name: string; avatar_hue: number; status: string };
type Act = { id: string; title: string; starts_at: string; credits: number; capacity: number; taken: number; pending: number; verified: number; organizer_name: string; started: boolean; roster: Reg[] };

export function OrganizerBoard({ activities }: { activities: Act[] }) {
  const toast = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, start] = useTransition();
  const verify = (r: Reg, attended: boolean, credits: number) => {
    setPendingId(r.id + attended);
    start(async () => {
      const res = await verifyParticipationAction(r.id, attended);
      setPendingId(null);
      if (!res.ok) return toast({ tone: "error", title: "Couldn't update", body: res.error });
      toast(
        attended
          ? { tone: "success", title: `${r.display_name} verified`, body: res.data.credited ? `${credits} credits were added to their balance.` : "Already verified earlier — no duplicate credits." }
          : { tone: "info", title: `Marked as not attended`, body: "No credits were added. Nothing was taken away." },
      );
    });
  };
  if (!activities.length) return <EmptyState icon={<CalendarDays />} title="No activities yet">Create an activity to invite students to help.</EmptyState>;
  return (
    <ul className="space-y-4">
      {activities.map((a) => (
        <li key={a.id} className="surface rounded-[var(--radius-card)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-display text-lg font-semibold">{a.title}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-3">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" aria-hidden /> {fmtDateTime(a.starts_at)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" aria-hidden /> {a.taken}/{a.capacity}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Coins className="size-3.5" aria-hidden /> {a.credits} credits each
                </span>
                <span>· organised by {a.organizer_name}</span>
              </p>
            </div>
            <div className="flex gap-2">
              {a.pending && a.started ? <Badge tone="ember">{a.pending} to verify</Badge> : null}
              {a.verified ? <Badge tone="mint">{a.verified} verified</Badge> : null}
              {!a.started ? <Badge tone="iris">Upcoming</Badge> : null}
            </div>
          </div>
          {a.roster.length ? (
            <ul className="mt-4 divide-y divide-line/60 rounded-2xl border border-line bg-ink-900/50 px-3">
              {a.roster.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="flex items-center gap-2.5 text-sm">
                    <Avatar name={r.display_name} hue={r.avatar_hue} size={30} /> {r.display_name}
                  </span>
                  {r.status === "verified" ? (
                    <Badge tone="mint" icon={<BadgeCheck />}>
                      Verified
                    </Badge>
                  ) : r.status === "not_verified" ? (
                    <Badge>Not attended</Badge>
                  ) : a.started ? (
                    <span className="flex gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => verify(r, false, a.credits)} loading={pendingId === r.id + false}>
                        <UserRoundX /> Didn't attend
                      </Button>
                      <Button size="sm" onClick={() => verify(r, true, a.credits)} loading={pendingId === r.id + true}>
                        <BadgeCheck /> Verify
                      </Button>
                    </span>
                  ) : (
                    <Badge tone="iris">Registered</Badge>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-fg-3">No registrations yet.</p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function NewActivityButton() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", description: "", category: "School", location: "", startsAt: "", durationMinutes: 60, capacity: 10, credits: 30 });
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const res = await createActivityAction({ ...f, startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : "" });
      if (!res.ok) return toast({ tone: "error", title: "Couldn't create", body: res.error });
      toast({ tone: "success", title: "Activity published", body: "Students can now register." });
      setOpen(false);
    });
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> New activity
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New volunteering activity"
        description="Only approved, safe activities. Credits are granted after you verify participation."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={pending}>
              Publish
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="na-title" className="sm:col-span-2">
            <Input id="na-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} />
          </Field>
          <Field label="Description" htmlFor="na-desc" className="sm:col-span-2">
            <Textarea id="na-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={4} maxLength={1000} />
          </Field>
          <Field label="Category" htmlFor="na-cat">
            <Select id="na-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {["School", "Environment", "Community", "Events", "Peer support"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Location" htmlFor="na-loc">
            <Input id="na-loc" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} maxLength={120} />
          </Field>
          <Field label="Starts" htmlFor="na-start">
            <Input id="na-start" type="datetime-local" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} />
          </Field>
          <Field label="Duration (minutes)" htmlFor="na-dur">
            <Input id="na-dur" type="number" min={15} max={600} value={f.durationMinutes} onChange={(e) => setF({ ...f, durationMinutes: Number(e.target.value) })} />
          </Field>
          <Field label="Places" htmlFor="na-cap">
            <Input id="na-cap" type="number" min={1} max={500} value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} />
          </Field>
          <Field label="Credits per student" htmlFor="na-cred">
            <Input id="na-cred" type="number" min={1} max={200} value={f.credits} onChange={(e) => setF({ ...f, credits: Number(e.target.value) })} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
