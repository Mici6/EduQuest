import "server-only";
import path from "node:path";
import { Db, dataDir, migrate } from "./client";
import { SCHEMA_VERSION } from "./schema";
import { seedDemo } from "./seed";

declare global {
  var __eduquestDb: Db | undefined;
  var __eduquestSchema: number | undefined;
}

/** Process-wide demo database (persisted under `.data/`). */
export function getDb(): Db {
  const cached = globalThis.__eduquestDb;
  // After a dev hot-reload the cached instance may come from an older class.
  if (cached && !(cached instanceof Db)) {
    try {
      (cached as { raw?: { close(): void } }).raw?.close();
    } catch {
      /* already closed */
    }
    globalThis.__eduquestDb = undefined;
  }
  if (!globalThis.__eduquestDb) {
    const file = path.join(dataDir(), "eduquest-demo.sqlite");
    const db = new Db(file);
    migrate(db);
    const seeded = db.get<{ value: string }>("SELECT value FROM meta WHERE key = 'seeded_at'");
    if (!seeded) seedDemo(db);
    globalThis.__eduquestDb = db;
    globalThis.__eduquestSchema = SCHEMA_VERSION;
  }
  // Apply additive schema changes to a long-lived instance (idempotent DDL).
  if (globalThis.__eduquestSchema !== SCHEMA_VERSION) {
    migrate(globalThis.__eduquestDb);
    globalThis.__eduquestSchema = SCHEMA_VERSION;
  }
  return globalThis.__eduquestDb;
}

export { Db } from "./client";
