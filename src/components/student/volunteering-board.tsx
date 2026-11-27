"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, CalendarDays, Clock, Coins, HandHeart, MapPin, UserRound } from "lucide-react";
import { cancelRegistrationAction, registerActivityAction } from "@/actions/student";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { PillTabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { fmtDateTime } from "@/lib/utils/format";

export type Activity = {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  starts_at: string;
  duration_minutes: number;
  capacity: number;
  credits: number;
  status: string;
  organizer_name: string;
  taken: number;
  my_status: string | null;
  past: boolean;
};

const STATUS: Record<string, { tone: "iris" | "mint" | "neutral" | "rose"; label: string }> = {
  registered: { tone: "iris", label: "Registered · awaiting verification" },
  verified: { tone: "mint", label: "Verified" },
  not_verified: { tone: "neutral", label: "Participation not verified" },
  cancelled: { tone: "neutral", label: "Cancelled" },
};

export function VolunteeringBoard({ activities }: { activities: Activity[] }) {
  const toast = useToast();
  const [filter, setFilter] = useState<"upcoming" | "mine" | "past">("upcoming");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [, start] = useTransition();
  const shown = activities.filter((a) =>
    filter === "upcoming" ? !a.past && a.status === "open" : filter === "mine" ? a.my_status && a.my_status !== "cancelled" : a.past,
  );

  const register = (a: Activity) => {
    setPendingId(a.id);
    start(async () => {
      const res = await registerActivityAction(a.id);
      setPendingId(null);
      toast(res.ok ? { tone: "success", title: "You're registered!", body: `Credits are added after ${a.organizer_name} verifies your participation.` } : { tone: "error", title: "Couldn't register", body: res.error });
    });
  };
  const cancel = () => {
    const id = cancelId!;
    setPendingId(id);
    start(async () => {
      const res = await cancelRegistrationAction(id);
      setPendingId(null);
      setCancelId(null);
      toast(res.ok ? { tone: "success", title: "Registration cancelled" } : { tone: "error", title: "Couldn't cancel", body: res.error });
    });
  };

  return (
    <>
      <PillTabs
        label="Filter activities"
        className="mb-5"
        value={filter}
        onChange={setFilter}
        items={[
          { value: "upcoming", label: "Upcoming", count: activities.filter((a) => !a.past && a.status === "open").length },
          { value: "mine", label: "My activities", count: activities.filter((a) => a.my_status && a.my_status !== "cancelled").length },
          { value: "past", label: "Past", count: activities.filter((a) => a.past).length },
        ]}
      />
      {shown.length ? (
        <ul className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
          {shown.map((a) => {
            const left = Math.max(0, a.capacity - a.taken);
            const registered = a.my_status === "registered";
            return (
              <li key={a.id} className="surface flex flex-col rounded-[var(--radius-card)] p-5">
                <div className="flex items-start justify-between gap-2">
                  <Badge tone="neutral">{a.category}</Badge>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber/15 px-2.5 py-1 text-xs font-bold text-amber">
                    <Coins className="size-3.5" aria-hidden /> {a.credits}
                  </span>
                </div>
                <h3 className="mt-3 font-display text-lg font-semibold leading-snug">{a.title}</h3>
                <p className="mt-1.5 line-clamp-3 text-sm text-fg-2">{a.description}</p>
                <dl className="mt-4 space-y-1.5 text-xs text-fg-2">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-3.5 text-fg-3" aria-hidden />
                    <dt className="sr-only">When</dt>
                    <dd>{fmtDateTime(a.starts_at)}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="size-3.5 text-fg-3" aria-hidden />
                    <dt className="sr-only">Duration</dt>
                    <dd>{a.duration_minutes >= 60 ? `${Math.floor(a.duration_minutes / 60)} h ${a.duration_minutes % 60 ? `${a.duration_minutes % 60} min` : ""}` : `${a.duration_minutes} min`}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="size-3.5 text-fg-3" aria-hidden />
                    <dt className="sr-only">Location</dt>
                    <dd>{a.location}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserRound className="size-3.5 text-fg-3" aria-hidden />
                    <dt className="sr-only">Organizer</dt>
                    <dd>{a.organizer_name}</dd>
                  </div>
                </dl>
                <div className="mt-auto pt-4">
                  {!a.past ? (
                    <div className="mb-3">
                      <div className="mb-1 flex justify-between text-[11px] text-fg-3">
                        <span>{left} of {a.capacity} places left</span>
                      </div>
                      <ProgressBar value={a.taken / a.capacity} size="sm" tone="ember" label="Places taken" />
                    </div>
                  ) : null}
                  {a.my_status ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge tone={STATUS[a.my_status]?.tone ?? "neutral"} icon={a.my_status === "verified" ? <BadgeCheck /> : undefined}>
                        {STATUS[a.my_status]?.label ?? a.my_status}
                      </Badge>
                      {registered && !a.past ? (
                        <Button variant="ghost" size="sm" onClick={() => setCancelId(a.id)} loading={pendingId === a.id}>
                          Cancel
                        </Button>
                      ) : null}
                      {a.my_status === "cancelled" && !a.past && a.status === "open" ? (
                        <Button size="sm" onClick={() => register(a)} loading={pendingId === a.id} disabled={!left}>
                          Register again
                        </Button>
                      ) : null}
                    </div>
                  ) : !a.past && a.status === "open" ? (
                    <Button className="w-full" onClick={() => register(a)} loading={pendingId === a.id} disabled={!left}>
                      {left ? "Register" : "Full"}
                    </Button>
                  ) : (
                    <p className="text-xs text-fg-3">Registration closed</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<HandHeart />} title={filter === "mine" ? "You haven't joined an activity yet" : "No activities here"}>
          {filter === "mine" ? "Browse upcoming activities and register — every verified activity earns credits." : "Check back soon for new opportunities."}
        </EmptyState>
      )}
      <ConfirmDialog open={!!cancelId} onClose={() => setCancelId(null)} onConfirm={cancel} title="Cancel your registration?" confirmLabel="Cancel registration" variant="danger" pending={!!pendingId}>
        Your place will be released for another student. You can register again while places remain.
      </ConfirmDialog>
    </>
  );
}
