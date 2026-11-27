import type { Metadata } from "next";
import { AiStatusNotice } from "@/components/study/ai-status";
import { QuizGenerator } from "@/components/study/quiz-generator";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { publicConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { listDocuments } from "@/lib/domain/documents";

export const metadata: Metadata = { title: "Quiz generator" };

export default async function QuizGenPage({ searchParams }: PageProps<"/app/study/quiz">) {
  const actor = await requireActor(["student"]);
  const sp = await searchParams;
  const cfg = publicConfig();
  const docs = listDocuments(getDb(), actor).filter((d) => d.status === "indexed").map((d) => ({ id: d.id, title: d.title, subject_name: d.subject_name }));
  const kind = sp.kind === "practice_test" ? "practice_test" : "quiz";
  return (
    <div>
      <PageHeader
        eyebrow="AI Study"
        title={kind === "practice_test" ? "Practice tests" : "Quiz generator"}
        description="Generate questions from your materials, then take them with instant explanations, XP and revision suggestions."
      />
      <AiStatusNotice mode={cfg.aiMode} model={cfg.aiModel} className="mb-5" />
      <QuizGenerator docs={docs} initialDocId={typeof sp.doc === "string" ? sp.doc : null} initialKind={kind} disabled={cfg.aiMode === "unavailable"} />
    </div>
  );
}
