import type { Metadata } from "next";
import { BROWSER_MODEL_LABEL } from "@/lib/ai/types";
import { AiStatusNotice } from "@/components/study/ai-status";
import { TutorChat } from "@/components/study/tutor-chat";
import { requireActor } from "@/lib/auth/current";
import { DomainError } from "@/lib/auth/errors";
import { getAiMode, publicConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { getConversation, listConversations } from "@/lib/domain/ai-service";
import { listDocuments } from "@/lib/domain/documents";

export const metadata: Metadata = { title: "AI tutor" };

export default async function ChatPage({ searchParams }: PageProps<"/app/study/chat">) {
  const actor = await requireActor(["student"]);
  const sp = await searchParams;
  const db = getDb();
  const cId = typeof sp.c === "string" ? sp.c : null;
  let conv: ReturnType<typeof getConversation> | null = null;
  if (cId) {
    try {
      conv = getConversation(db, actor, cId);
    } catch (e) {
      if (!(e instanceof DomainError)) throw e;
    }
  }
  const cfg = publicConfig();
  const docs = listDocuments(db, actor).filter((d) => d.status === "indexed").map((d) => ({ id: d.id, title: d.title }));
  return (
    <div>
      <h1 className="sr-only">AI tutor</h1>
      <AiStatusNotice mode={cfg.aiMode} model={cfg.aiModel} className="mb-4" />
      <TutorChat
        key={conv?.conv.id ?? "new"}
        initialConversationId={conv?.conv.id ?? null}
        initialMessages={(conv?.messages ?? []).map((m) => ({ id: m.id, role: m.role, content: m.content, sources: m.sources, grounding: m.grounding, provider: m.provider === "browser" ? BROWSER_MODEL_LABEL : m.provider === "cloud" ? "Cloud AI" : m.provider, simulated: m.simulated === 1 }))}
        conversations={listConversations(db, actor).map((c) => ({ id: c.id, title: c.title, updated_at: c.updated_at }))}
        docs={docs}
        initialDocId={typeof sp.doc === "string" ? sp.doc : (conv?.conv.document_id ?? null)}
        initialPrompt={typeof sp.q === "string" ? sp.q.slice(0, 500) : null}
        aiAvailable={getAiMode() !== "unavailable"}
        studentName={actor.displayName.split(" ")[0]!}
      />
    </div>
  );
}
