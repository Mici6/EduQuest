import type { Metadata } from "next";
import { NewActivityButton, OrganizerBoard } from "@/components/teacher/organizer-board";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { organizerView } from "@/lib/domain/teacher";

export const metadata: Metadata = { title: "Volunteering" };

export default async function TeacherVolunteering() {
  const actor = await requireActor(["teacher"]);
  return (
    <div>
      <PageHeader eyebrow="Community" title="Volunteering you organise" description="Verify who took part. Only verified participation earns credits, and each registration can be credited only once." actions={<NewActivityButton />} />
      <Notice tone="info" className="mb-5">
        Marking “didn't attend” never removes credits a student already has — EduQuest has no way to take credits away as a penalty.
      </Notice>
      <OrganizerBoard activities={organizerView(getDb(), actor)} />
    </div>
  );
}
