import type { Metadata } from "next";
import { HeartHandshake, ShieldCheck } from "lucide-react";
import { VolunteeringBoard } from "@/components/student/volunteering-board";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { Notice } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { creditSummary, listActivities } from "@/lib/domain/credits";
import { toDate } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Volunteering" };

export default async function VolunteeringPage() {
  const actor = await requireActor(["student"]);
  const db = getDb();
  const now = Date.now();
  const activities = listActivities(db, actor).map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    category: a.category,
    location: a.location,
    starts_at: a.starts_at,
    duration_minutes: a.duration_minutes,
    capacity: a.capacity,
    credits: a.credits,
    status: a.status,
    organizer_name: a.organizer_name,
    taken: a.taken,
    my_status: a.my_status,
    past: toDate(a.starts_at).getTime() <= now,
  }));
  const verified = activities.filter((a) => a.my_status === "verified").length;
  const credits = creditSummary(db, actor.id);
  const hours = Math.round(activities.filter((a) => a.my_status === "verified").reduce((s, a) => s + a.duration_minutes, 0) / 6) / 10;
  return (
    <div>
      <PageHeader eyebrow="Community" title="Volunteering" description="Help your school and community. Organizers verify participation, and verified activities earn credits you can spend on ready-made mini-courses." />
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard label="Credits earned from volunteering" value={credits.earned} accent="sun" icon={<HeartHandshake />} />
        <StatCard label="Verified activities" value={verified} accent="mint" />
        <StatCard label="Hours contributed" value={hours} accent="iris" />
      </div>
      <Card tone="flat" className="mb-6 !p-0">
        <Notice tone="success" icon={<ShieldCheck />} title="Credits are yours to keep" className="!border-0">
          Credits are only added after an organizer verifies you took part, and they are never removed because of absences, grades or discipline.
        </Notice>
      </Card>
      <VolunteeringBoard activities={activities} />
    </div>
  );
}
