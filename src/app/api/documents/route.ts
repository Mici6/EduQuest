import { getActor } from "@/lib/auth/current";
import { DomainError, httpStatus, publicMessage } from "@/lib/auth/errors";
import { config } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { schoolSettings } from "@/lib/domain/admin";
import { processUpload } from "@/lib/domain/documents";
import { extractText } from "@/lib/documents/extract";
import { putObject } from "@/lib/documents/storage";
import { isSameOrigin, ndjsonStream, rateLimit } from "@/lib/http";

export const runtime = "nodejs";

/** Upload + processing pipeline. Streams real per-step status as NDJSON. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const actor = await getActor();
  if (!actor) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (actor.role === "support") return Response.json({ error: "Uploads are not available for this role." }, { status: 403 });
  const db = getDb();
  if (actor.role === "student" && !schoolSettings(db, actor.schoolId).studentUploadsEnabled) {
    return Response.json({ error: "Your school has turned off student uploads." }, { status: 403 });
  }
  if (!rateLimit(`upload:${actor.id}`, 30, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many uploads. Please wait a while and try again." }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
  if (file.size > config.maxUploadBytes) {
    return Response.json({ error: `The file is larger than ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB.` }, { status: 413 });
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const visibility = String(form.get("visibility") ?? "");

  return ndjsonStream(async (send) => {
    try {
      const events = processUpload(
        db,
        actor,
        {
          fileName: file.name,
          data,
          title: String(form.get("title") ?? ""),
          subjectId: form.get("subjectId") ? String(form.get("subjectId")) : null,
          classId: form.get("classId") ? String(form.get("classId")) : null,
          visibility: visibility === "class" || visibility === "school" || visibility === "private" ? visibility : undefined,
        },
        {
          maxBytes: config.maxUploadBytes,
          store: putObject,
          extract: (kind, bytes, mime) => extractText(kind, bytes, mime),
        },
      );
      for await (const e of events) send(e);
    } catch (err) {
      if (!(err instanceof DomainError)) console.error("[upload] failed", err);
      send({ step: "error", message: publicMessage(err), status: httpStatus(err) });
    }
  });
}
