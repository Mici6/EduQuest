import { getAiMode, config } from "@/lib/config/env";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

/** Liveness/readiness probe. Reports configuration modes, never secrets. */
export async function GET() {
  let database = "ok";
  try {
    getDb().get("SELECT 1");
  } catch {
    database = "error";
  }
  return Response.json({ status: database === "ok" ? "ok" : "degraded", mode: config.mode, ai: getAiMode(), database });
}
