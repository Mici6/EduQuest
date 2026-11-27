import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "../db";
import { homeFor } from "./routes";
import { SESSION_COOKIE, verifySessionToken } from "./session";
import type { Actor, Role } from "./types";

type UserRow = { id: string; role: Role; school_id: string; display_name: string; active: number };

/** Resolve the signed-in actor for this request (memoised per request). */
export const getActor = cache(async (): Promise<Actor | null> => {
  const jar = await cookies();
  const claims = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const user = getDb().get<UserRow>(
    `SELECT id, role, school_id, display_name, active FROM users WHERE id = ?`,
    claims.uid,
  );
  // The database is authoritative: a deactivated user or a changed role ends the session.
  if (!user || !user.active || user.role !== claims.role) return null;
  return { id: user.id, role: user.role, schoolId: user.school_id, displayName: user.display_name };
});

/** Page/server-action guard. Redirects to sign-in, or to the actor's home if the role is wrong. */
export async function requireActor(roles?: readonly Role[]): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (roles && !roles.includes(actor.role)) redirect(homeFor(actor.role) + "?denied=1");
  return actor;
}

export { homeFor };
