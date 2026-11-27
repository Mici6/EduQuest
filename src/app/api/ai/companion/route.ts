import { getActor } from "@/lib/auth/current";
import { DomainError, httpStatus, publicMessage } from "@/lib/auth/errors";
import { aiFor } from "@/lib/ai/guard";
import { getDb } from "@/lib/db";
import { companionContext, companionTurn } from "@/lib/domain/companion";
import { isSameOrigin, ndjsonStream } from "@/lib/http";

export const runtime = "nodejs";

/**
 * Irbis, the snow-leopard companion. Streams NDJSON:
 *   {type:"delta", text} … {type:"done"} | {type:"error", message}
 * Students only. The conversation is kept in the browser; each request counts
 * against the student's daily AI limit.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const actor = await getActor();
  if (!actor) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (actor.role !== "student") return Response.json({ error: "Irbis is a companion for students." }, { status: 403 });

  let body: { message?: unknown; history?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const db = getDb();
  let turn: ReturnType<typeof companionTurn>;
  let ai: ReturnType<typeof aiFor>;
  try {
    turn = companionTurn(body);
    ai = aiFor(db, actor);
    if (!ai.companion) throw new DomainError("Irbis needs the cloud AI or demo mode.", "unavailable");
  } catch (err) {
    if (!(err instanceof DomainError)) console.error("[companion] prepare failed", err);
    return Response.json({ error: publicMessage(err) }, { status: httpStatus(err) });
  }
  const context = companionContext(db, actor);
  const companion = ai.companion!.bind(ai);

  return ndjsonStream(async (send) => {
    try {
      for await (const text of companion({ ...turn, context }, req.signal)) send({ type: "delta", text });
      send({ type: "done" });
    } catch (err) {
      if (req.signal.aborted) return;
      console.error("[companion] provider error", err);
      send({ type: "error", message: err instanceof DomainError ? err.message : "Irbis couldn't answer right now. Please try again." });
    }
  });
}
