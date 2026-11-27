import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { AddProjectForm, IssuePassportButton } from "@/components/passport/passport-controls";
import { PassportSections } from "@/components/passport/passport-sections";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { passportData } from "@/lib/domain/passport";
import { fmtDateLong as fmtDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Skills Passport" };

export default async function PassportPage() {
  const actor = await requireActor(["student"]);
  const data = passportData(getDb(), actor, actor.id);
  return (
    <div>
      <PageHeader
        eyebrow="Portfolio"
        title="Skills Passport"
        description={`Everything you've done that ${data.student.schoolName} can vouch for. Issue a sealed copy to attach to university, scholarship or volunteering applications.`}
        actions={<IssuePassportButton />}
      />
      <Card tone="flat" className="mb-5 !p-0">
        <Notice tone="success" icon={<ShieldCheck />} title="Why it's credible" className="!border-0">
          A sealed passport carries your school&apos;s digital seal. Anyone with the link can check it&apos;s genuine and unaltered on a public verification page, and you can revoke a link at any time. {data.student.className ? `${data.student.className} · ` : ""}In EduQuest since {fmtDate(data.student.memberSince)}.
        </Notice>
      </Card>
      <div className="grid gap-5 @5xl:grid-cols-[minmax(0,1fr)_340px]">
        <PassportSections data={data} mode="student" />
        <div className="h-fit @5xl:sticky @5xl:top-6">
          <AddProjectForm />
        </div>
      </div>
    </div>
  );
}
