import { getActor } from "@/lib/auth/current";
import { DomainError, httpStatus, publicMessage } from "@/lib/auth/errors";
import { aiAllowed, aiFor } from "@/lib/ai/guard";
import type { TutorLevel } from "@/lib/ai/types";
import { getDb } from "@/lib/db";
import { prepareTutorTurn, saveAssistantMessage, toSources } from "@/lib/domain/ai-service";
import { isSameOrigin, ndjsonStream } from "@/lib/http";

export const runtime = "nodejs";

/**
 * Streaming tutor endpoint. Emits NDJSON events:
 *   {type:"meta", conversationId, sources, grounding, provider}
 *   {type:"delta", text}
 *   {type:"done"} | {type:"error", message}
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const actor = await getActor();
  if (!actor) return Response.json({ error: "Sign in required." }, { status: 401 });

  // local: true → the browser runs the model; return the prepared turn instead of streaming.
  let body: { conversationId?: string | null; message?: string; documentId?: string | null; level?: TutorLevel; local?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const db = getDb();
  let turn: ReturnType<typeof prepareTutorTurn>;
  let provider: ReturnType<typeof aiFor> | null = null;
  try {
    if (body.local === true) aiAllowed(db, actor);
    else provider = aiFor(db, actor);
    turn = prepareTutorTurn(db, actor, {
      conversationId: body.conversationId ? String(body.conversationId) : null,
      message: String(body.message ?? ""),
      documentId: body.documentId ? String(body.documentId) : null,
      level: body.level === "simpler" || body.level === "advanced" ? body.level : "standard",
    });
  } catch (err) {
    if (!(err instanceof DomainError)) console.error("[chat] prepare failed", err);
    return Response.json({ error: publicMessage(err) }, { status: httpStatus(err) });
  }

  const sources = toSources(turn.sources);
  const grounding = turn.grounded ? "lesson" : "general";
  if (!provider) {
    return Response.json({ conversationId: turn.conversationId, sources, grounding, history: turn.history, chunks: turn.sources, grounded: turn.grounded, studentName: actor.displayName.split(" ")[0]! });
  }
  const ai = provider;

  return ndjsonStream(async (send) => {
    send({ type: "meta", conversationId: turn.conversationId, sources, grounding, provider: { label: ai.label, simulated: ai.simulated } });
    let text = "";
    try {
      for await (const delta of ai.tutor(
        {
          question: String(body.message ?? "").trim(),
          history: turn.history,
          sources: turn.sources,
          grounded: turn.grounded,
          level: body.level === "simpler" || body.level === "advanced" ? body.level : "standard",
          studentName: actor.displayName.split(" ")[0]!,
        },
        req.signal,
      )) {
        text += delta;
        send({ type: "delta", text: delta });
      }
      saveAssistantMessage(db, actor, turn.conversationId, text, sources, grounding, ai);
      send({ type: "done" });
    } catch (err) {
      if (req.signal.aborted) {
        if (text) saveAssistantMessage(db, actor, turn.conversationId, text + "\n\n_(stopped)_", sources, grounding, ai);
        return;
      }
      console.error("[chat] provider error", err);
      send({ type: "error", message: "The AI service could not answer right now. Please try again." });
    }
  });
}
