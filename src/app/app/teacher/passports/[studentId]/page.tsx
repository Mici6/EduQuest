import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PassportSections } from "@/components/passport/passport-sections";
import { RecommendationComposer } from "@/components/passport/recommendation-composer";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { DomainError } from "@/lib/auth/errors";
import { publicConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { homeroomStudents, passportData, recommendationEligibility } from "@/lib/domain/passport";

export const metadata: Metadata = { title: "Student passport" };

export default async function TeacherStudentPassportPage({ params }: PageProps<"/app/teacher/passports/[studentId]">) {
  const actor = await requireActor(["teacher"]);
  const { studentId } = await params;
  const db = getDb();
  let data;
  try {
    data = passportData(db, actor, studentId);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const isHomeroom = homeroomStudents(db, actor).some((s) => s.id === studentId);
  const elig = recommendationEligibility(db, studentId);
  const cfg = publicConfig();
  return (
    <div>
      <PageHeader
        eyebrow={data.student.className ?? "Student"}
        title={data.student.name}
        description="Skills Passport as the student sees it. Verify projects you can vouch for."
        actions={
          <ButtonLink href="/app/teacher/passports" variant="ghost">
            All students
          </ButtonLink>
        }
      />
      <div className="space-y-5">
        {isHomeroom ? (
          <RecommendationComposer
            studentId={studentId}
            studentName={data.student.name}
            teacherName={actor.displayName}
            eligible={elig.eligible}
            daysLeft={elig.daysLeft}
            aiLabel={cfg.aiMode === "cloud" ? (cfg.aiModel ?? "the cloud AI") : "a simple template"}
          />
        ) : null}
        <PassportSections data={data} mode="teacher" />
      </div>
    </div>
  );
}
