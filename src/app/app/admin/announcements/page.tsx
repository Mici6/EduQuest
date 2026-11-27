import type { Metadata } from "next";
import { AnnouncementComposer } from "@/components/teacher/announcement-composer";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { announcementsFor } from "@/lib/domain/catalog";
import { relativeTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Announcements" };

export default async function AdminAnnouncements() {
  const actor = await requireActor(["admin"]);
  const items = announcementsFor(getDb(), actor, 40);
  return (
    <div>
      <PageHeader eyebrow="School administration" title="Announcements" description="School-wide messages reach every student and member of staff (respecting notification preferences)." />
      <div className="grid gap-5 @4xl:grid-cols-12">
        <Card className="h-fit @4xl:col-span-5">
          <CardHeader title="New school-wide announcement" />
          <AnnouncementComposer classes={[]} schoolWide />
        </Card>
        <ul className="space-y-3 @4xl:col-span-7">
          {items.map((a) => (
            <li key={a.id} className="surface rounded-[22px] p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone={a.class_name ? "iris" : "neutral"}>{a.class_name ?? "Whole school"}</Badge>
                <span className="ml-auto text-xs text-fg-3">
                  {a.author_name} · {relativeTime(a.created_at)}
                </span>
              </div>
              <p className="font-semibold">{a.title}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-fg-2">{a.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
