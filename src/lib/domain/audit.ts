import type { Db } from "../db/client";
import { newId } from "../db/client";

/** Append an audit record for a sensitive operation. Never stores record contents. */
export function audit(
  db: Db,
  actorId: string | null,
  action: string,
  resourceType: string,
  resourceId: string | null,
  metadata: Record<string, string | number | boolean | null> = {},
) {
  db.run(
    `INSERT INTO audit_logs (id, actor_id, action, resource_type, resource_id, metadata) VALUES (?, ?, ?, ?, ?, ?)`,
    newId("aud_"),
    actorId,
    action,
    resourceType,
    resourceId,
    JSON.stringify(metadata),
  );
}
