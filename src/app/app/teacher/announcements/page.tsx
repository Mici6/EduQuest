import type { Metadata } from "next";
import { Pin } from "lucide-react";
import { AnnouncementComposer } from "@/components/teacher/announcement-composer";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { announcementsFor, teacherClasses } from "@/lib/domain/catalog";
import { relativeTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Announcements" };

export default async function TeacherAnnouncements() {
  const actor = await requireActor(["teacher"]);
  const db = getDb();
  const classes = [...new Map(teacherClasses(db, actor).map((p) => [p.class_id, { id: p.class_id, name: p.class_name }])).values()];
  const items = announcementsFor(db, actor, 30);
  return (
    <div>
      <PageHeader eyebrow="Teaching" title="Announcements" description="Share news with a class. Students are notified according to their preferences." />
      <div className="grid gap-5 @4xl:grid-cols-12">
        <Card className="h-fit @4xl:col-span-5">
          <CardHeader title="New class announcement" />
          <AnnouncementComposer classes={classes} schoolWide={false} />
        </Card>
        <ul className="space-y-3 @4xl:col-span-7">
          {items.map((a) => (
            <li key={a.id}>
              <Card className="!p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {a.pinned ? (
                    <Badge tone="sun" icon={<Pin />}>
                      Pinned
                    </Badge>
                  ) : null}
                  <Badge tone={a.class_name ? "iris" : "neutral"}>{a.class_name ?? "Whole school"}</Badge>
                  <span className="ml-auto text-xs text-fg-3">{relativeTime(a.created_at)}</span>
                </div>
                <p className="font-semibold">{a.title}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-fg-2">{a.body}</p>
                <p className="mt-2 text-xs text-fg-3">— {a.author_name}</p>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
