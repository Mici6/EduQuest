import type { Metadata } from "next";
import { AiStatusNotice } from "@/components/study/ai-status";
import { HomeworkHelper } from "@/components/study/homework-helper";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { publicConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { subjectsForSchool } from "@/lib/domain/catalog";

export const metadata: Metadata = { title: "Homework helper" };

export default async function HomeworkHelperPage() {
  const actor = await requireActor(["student"]);
  const cfg = publicConfig();
  return (
    <div>
      <PageHeader eyebrow="AI Study" title="Homework helper" description="Get a guided, step-by-step path to the solution — with checks along the way — instead of a copied answer." />
      <AiStatusNotice mode={cfg.aiMode} model={cfg.aiModel} className="mb-5" />
      <HomeworkHelper disabled={cfg.aiMode === "unavailable"} subjects={subjectsForSchool(getDb(), actor.schoolId).map((s) => ({ id: s.id, name: s.name }))} />
    </div>
  );
}
