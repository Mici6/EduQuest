import type { Metadata } from "next";
import { AiStatusNotice } from "@/components/study/ai-status";
import { SummaryTool } from "@/components/study/summary-tool";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { publicConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { listDocuments } from "@/lib/domain/documents";

export const metadata: Metadata = { title: "Summaries" };

export default async function SummaryPage({ searchParams }: PageProps<"/app/study/summary">) {
  const actor = await requireActor(["student"]);
  const sp = await searchParams;
  const cfg = publicConfig();
  const docs = listDocuments(getDb(), actor).filter((d) => d.status === "indexed").map((d) => ({ id: d.id, title: d.title, subject_name: d.subject_name }));
  return (
    <div>
      <PageHeader eyebrow="AI Study" title="Summaries" description="Turn a lesson into concise notes, a chapter summary or a structured revision sheet with key concepts, definitions, formulas and dates." />
      <AiStatusNotice mode={cfg.aiMode} model={cfg.aiModel} className="mb-5" />
      <SummaryTool docs={docs} initialDocId={typeof sp.doc === "string" ? sp.doc : null} disabled={cfg.aiMode === "unavailable"} />
    </div>
  );
}
