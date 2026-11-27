import type { Metadata } from "next";
import { AiStatusNotice } from "@/components/study/ai-status";
import { DraftList, StudioWorkspace } from "@/components/teacher/studio";
import { LinkTabs } from "@/components/ui/link-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { publicConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { teacherClasses } from "@/lib/domain/catalog";
import { listDocuments } from "@/lib/domain/documents";
import { studioContent } from "@/lib/domain/teacher";

export const metadata: Metadata = { title: "AI Studio" };

export default async function StudioPage({ searchParams }: PageProps<"/app/teacher/studio">) {
  const actor = await requireActor(["teacher"]);
  const sp = await searchParams;
  const tab = sp.tab === "drafts" ? "drafts" : "create";
  const db = getDb();
  const cfg = publicConfig();
  const content = studioContent(db, actor);
  const pairs = teacherClasses(db, actor).map((p) => ({ class_id: p.class_id, class_name: p.class_name, subject_id: p.subject_id, subject_name: p.subject_name }));
  const classes = [...new Map(pairs.map((p) => [p.class_id, { id: p.class_id, name: p.class_name }])).values()];
  const docs = listDocuments(db, actor).filter((d) => d.status === "indexed").map((d) => ({ id: d.id, title: d.title, subject_name: d.subject_name }));
  return (
    <div>
      <PageHeader eyebrow="Teaching" title="AI Studio" description="Generate summaries, quizzes, practice tests, flashcards and homework from your lessons. Everything is reviewed by you before students see it." />
      <AiStatusNotice mode={cfg.aiMode} model={cfg.aiModel} className="mb-5" />
      <LinkTabs
        label="Studio sections"
        className="mb-5"
        items={[
          { href: "/app/teacher/studio", label: "Create", active: tab === "create" },
          { href: "/app/teacher/studio?tab=drafts", label: "Drafts & published", active: tab === "drafts", count: content.filter((c) => c.status === "draft").length },
        ]}
      />
      {tab === "create" ? (
        <StudioWorkspace docs={docs} pairs={pairs} initialDocId={typeof sp.doc === "string" ? sp.doc : null} disabled={cfg.aiMode === "unavailable"} />
      ) : (
        <DraftList drafts={content} classes={classes} />
      )}
    </div>
  );
}
