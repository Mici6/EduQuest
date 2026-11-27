"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { homeFor } from "@/lib/auth/current";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import type { Role } from "@/lib/auth/types";
import { config } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { resetDemo } from "@/lib/db/seed";
import { audit } from "@/lib/domain/audit";

/** Demo-mode sign-in: only flagged demo accounts, never in production mode. */
export async function signInDemo(userId: string) {
  if (config.mode !== "demo") throw new Error("Demo sign-in is disabled in production mode.");
  const db = getDb();
  const user = db.get<{ id: string; role: Role }>(`SELECT id, role FROM users WHERE id = ? AND is_demo = 1 AND active = 1`, String(userId));
  if (!user) redirect("/login?error=unknown");
  (await cookies()).set(SESSION_COOKIE, createSessionToken(user.id, user.role), sessionCookieOptions);
  audit(db, user.id, "auth.demo_sign_in", "user", user.id);
  redirect(homeFor(user.role));
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

/**
 * Rebuild the demo dataset with fresh, current dates. Demo mode only: it
 * never exists in production mode, where data is real.
 */
export async function resetDemoData() {
  if (config.mode !== "demo") throw new Error("Not available in production mode.");
  if (!config.demoResetAllowed) throw new Error("Resetting the demo is turned off on this server.");
  resetDemo(getDb());
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login?reset=1");
}
