import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";
import fs from "node:fs";
import { dataDirPath } from "../config/data-dir";
import { SCHEMA_SQL, SCHEMA_VERSION, creditTransactionsDdl } from "./schema";

/**
 * Thin, typed wrapper around node:sqlite used by the demo backend.
 * Every domain module receives a `Db` so tests can run against an
 * isolated in-memory database.
 */
export class Db {
  readonly raw: DatabaseSync;
  private depth = 0;
  private statements = new Map<string, StatementSync>();

  constructor(file: string) {
    this.raw = new DatabaseSync(file);
    this.raw.exec("PRAGMA foreign_keys = ON;");
    if (file !== ":memory:") {
      this.raw.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    }
  }

  /** Prepared statements are cached by SQL text (bounded). */
  private stmt(sql: string): StatementSync {
    let s = this.statements.get(sql);
    if (!s) {
      if (this.statements.size > 400) this.statements.clear();
      s = this.raw.prepare(sql);
      this.statements.set(sql, s);
    }
    return s;
  }

  // node:sqlite returns null-prototype rows; copy them into plain objects so
  // they can be serialised to Client Components and compared normally.
  all<T>(sql: string, ...params: SQLInputValue[]): T[] {
    return this.stmt(sql)
      .all(...params)
      .map((r) => ({ ...r }) as T);
  }

  get<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
    const r = this.stmt(sql).get(...params);
    return r ? ({ ...r } as T) : undefined;
  }

  run(sql: string, ...params: SQLInputValue[]) {
    return this.stmt(sql).run(...params);
  }

  exec(sql: string) {
    // Schema changes invalidate cached statements.
    this.statements.clear();
    this.raw.exec(sql);
  }

  /**
   * Run `fn` inside a write transaction. `BEGIN IMMEDIATE` takes the write
   * lock up front so balance checks and debits cannot interleave with
   * another writer. Nested calls join the outer transaction.
   */
  tx<T>(fn: () => T): T {
    if (this.depth > 0) {
      this.depth++;
      try {
        return fn();
      } finally {
        this.depth--;
      }
    }
    this.raw.exec("BEGIN IMMEDIATE");
    this.depth = 1;
    try {
      const result = fn();
      this.raw.exec("COMMIT");
      return result;
    } catch (err) {
      this.raw.exec("ROLLBACK");
      throw err;
    } finally {
      this.depth = 0;
    }
  }
}

export function migrate(db: Db) {
  db.exec(SCHEMA_SQL);
  upgradeCreditLedger(db);
  upgradeAiCourseGrants(db);
  // v7: the voucher shop was removed; its ledger rows stay (append-only), its tables go.
  db.exec(`DROP TABLE IF EXISTS voucher_redemptions; DROP TABLE IF EXISTS reward_offers; DROP TABLE IF EXISTS reward_partners;`);
  db.run(
    "INSERT INTO meta(key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    String(SCHEMA_VERSION),
  );
}

/** v8: add the grant-workflow columns to existing ai_courses tables and backfill their status. */
function upgradeAiCourseGrants(db: Db) {
  const cols = new Set(db.all<{ name: string }>(`PRAGMA table_info(ai_courses)`).map((c) => c.name));
  if (cols.has("grant_status")) return;
  db.tx(() => {
    db.exec(`ALTER TABLE ai_courses ADD COLUMN grant_status TEXT NOT NULL DEFAULT 'none' CHECK (grant_status IN ('none','requested','recommended','declined','approved','released'))`);
    db.exec(`ALTER TABLE ai_courses ADD COLUMN grant_recommended INTEGER NOT NULL DEFAULT 0 CHECK (grant_recommended >= 0)`);
    db.exec(`ALTER TABLE ai_courses ADD COLUMN grant_note TEXT`);
    db.exec(`ALTER TABLE ai_courses ADD COLUMN grant_decided_by TEXT REFERENCES users(id)`);
    db.exec(`ALTER TABLE ai_courses ADD COLUMN grant_decided_at TEXT`);
    db.exec(`UPDATE ai_courses SET grant_status = CASE
      WHEN grant_approved > 0 AND status = 'accredited' THEN 'released'
      WHEN grant_approved > 0 THEN 'approved'
      WHEN grant_requested > 0 AND status = 'pending_review' THEN 'requested'
      WHEN grant_requested > 0 THEN 'declined' ELSE 'none' END,
      grant_recommended = grant_approved, grant_decided_at = CASE WHEN grant_approved > 0 THEN reviewed_at END`);
  });
}

/**
 * v5: allow spending credits on mini-courses. SQLite can't alter a CHECK
 * constraint, so rebuild the ledger table once, keeping every row and id.
 */
function upgradeCreditLedger(db: Db) {
  const sql = db.get<{ sql: string }>(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'credit_transactions'`)?.sql ?? "";
  if (sql.includes("course_unlock")) return;
  db.exec("PRAGMA foreign_keys = OFF;");
  try {
    db.tx(() => {
      for (const t of ["credits_no_update", "credits_no_delete", "credits_non_negative"]) db.exec(`DROP TRIGGER IF EXISTS ${t}`);
      db.exec(creditTransactionsDdl("credit_transactions_v5"));
      db.exec(`INSERT INTO credit_transactions_v5 SELECT * FROM credit_transactions`);
      db.exec(`DROP TABLE credit_transactions`);
      db.exec(`ALTER TABLE credit_transactions_v5 RENAME TO credit_transactions`);
    });
  } finally {
    db.exec("PRAGMA foreign_keys = ON;");
  }
  db.exec(SCHEMA_SQL); // recreate the index and append-only triggers
}

export function newId(prefix = ""): string {
  return prefix + crypto.randomUUID();
}

export function dataDir(): string {
  const dir = dataDirPath();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function json<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
