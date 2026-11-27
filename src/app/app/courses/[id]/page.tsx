import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoursePlayer } from "@/components/courses/course-player";
import { CourseIcon } from "@/components/courses/course-icon";
import { IconChip } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { DomainError } from "@/lib/auth/errors";
import { getDb } from "@/lib/db";
import { courseView } from "@/lib/domain/courses";

export const metadata: Metadata = { title: "Mini-course" };

export default async function CoursePage({ params }: PageProps<"/app/courses/[id]">) {
  const actor = await requireActor(["student"]);
  const { id } = await params;
  let course;
  try {
    course = courseView(getDb(), actor, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  return (
    <div>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <IconChip tone="sun" className="size-6 [&_svg]:size-3.5">
              <CourseIcon icon={course.icon} />
            </IconChip>
            Mini-course · ~{course.minutes} min
          </span>
        }
        title={course.title}
        description={course.summary}
      />
      {/* Remount after unlocking so the quiz answer state matches the newly revealed questions. */}
      <CoursePlayer key={String(course.unlocked)} course={course} />
    </div>
  );
}
