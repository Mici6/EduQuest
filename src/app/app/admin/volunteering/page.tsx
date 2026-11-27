import type { Metadata } from "next";
import { NewActivityButton, OrganizerBoard } from "@/components/teacher/organizer-board";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { organizerView } from "@/lib/domain/teacher";

export const metadata: Metadata = { title: "Volunteering" };

export default async function AdminVolunteering() {
  const actor = await requireActor(["admin"]);
  return (
    <div>
      <PageHeader eyebrow="School administration" title="Volunteering programme" description="All approved activities across the school. Administrators can verify participation for any activity." actions={<NewActivityButton />} />
      <OrganizerBoard activities={organizerView(getDb(), actor)} />
    </div>
  );
}
