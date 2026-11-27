import type { Metadata } from "next";
import { AiStatusNotice } from "@/components/study/ai-status";
import { StudyPlanner } from "@/components/study/study-planner";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { publicConfig } from "@/lib/config/env";

export const metadata: Metadata = { title: "Study plan" };

export default async function PlanPage() {
  await requireActor(["student"]);
  const cfg = publicConfig();
  return (
    <div>
      <PageHeader eyebrow="AI Study" title="Personal study plan" description="A short, realistic revision plan that fits your week and focuses where a little extra practice could help." />
      <AiStatusNotice mode={cfg.aiMode} model={cfg.aiModel} className="mb-5" />
      <StudyPlanner disabled={cfg.aiMode === "unavailable"} />
    </div>
  );
}
