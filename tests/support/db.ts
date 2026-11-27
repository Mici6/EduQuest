import { Db, migrate } from "../../src/lib/db/client";
import { seedDemo } from "../../src/lib/db/seed";
import type { Actor, Role } from "../../src/lib/auth/types";

/** Fresh, fully seeded in-memory demo database for each test file. */
export function seededDb(now = new Date()): Db {
  const db = new Db(":memory:");
  migrate(db);
  seedDemo(db, now);
  return db;
}

export function actor(db: Db, id: string): Actor {
  const u = db.get<{ id: string; role: Role; school_id: string; display_name: string }>(
    `SELECT id, role, school_id, display_name FROM users WHERE id = ?`,
    id,
  );
  if (!u) throw new Error(`no user ${id}`);
  return { id: u.id, role: u.role, schoolId: u.school_id, displayName: u.display_name };
}
