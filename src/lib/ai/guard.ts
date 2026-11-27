import "server-only";
import { DomainError } from "../auth/errors";
import type { Actor } from "../auth/types";
import { getAiMode } from "../config/env";
import type { Db } from "../db/client";
import { schoolSettings } from "../domain/admin";
import { consumeAiQuota } from "../domain/ai-service";
import { AiUnavailableError, getProvider } from "./index";
import type { AiProvider } from "./types";

/**
 * Resolve the AI provider for a request after applying school policy and
 * per-user daily limits. Throws user-safe DomainErrors.
 */
export function aiFor(db: Db, actor: Actor): AiProvider {
  aiAllowed(db, actor);
  return getProvider();
}

/** Policy and daily-quota check only, for requests the browser model will answer. */
export function aiAllowed(db: Db, actor: Actor) {
  if (getAiMode() === "unavailable") {
    throw new DomainError("AI features are turned off for this deployment (AI_BROWSER and AI_SIMULATION are both off).", "unavailable");
  }
  const settings = schoolSettings(db, actor.schoolId);
  if (actor.role === "student" && !settings.aiEnabledForStudents) {
    throw new DomainError("Your school has turned off AI study tools for students.", "forbidden");
  }
  consumeAiQuota(db, actor, settings.aiDailyLimit);
}

/** Convert provider/network failures into a friendly, non-leaky error. */
export async function withAiErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof DomainError) throw err;
    if (err instanceof AiUnavailableError) throw new DomainError(err.message, "unavailable");
    console.error("[ai] provider error", err);
    throw new DomainError("The AI service could not complete this request. Please try again in a moment.", "unavailable");
  }
}
