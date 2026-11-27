import "server-only";
import { unstable_rethrow } from "next/navigation";
import { DomainError, publicMessage } from "@/lib/auth/errors";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Run a server-action body: domain errors become safe messages for the UI;
 * redirects and other framework control flow are re-thrown.
 */
export async function attempt<T>(fn: () => T | Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    unstable_rethrow(err);
    if (!(err instanceof DomainError)) console.error("[action] unexpected error", err);
    return { ok: false, error: publicMessage(err) };
  }
}
