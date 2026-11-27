import { beforeEach, describe, expect, it } from "vitest";
import { actor, seededDb } from "./support/db";
import type { Db } from "../src/lib/db/client";
import * as credits from "../src/lib/domain/credits";
import { creditBalance, verifyParticipation } from "../src/lib/domain/credits";

let db: Db;
beforeEach(() => {
  db = seededDb();
});

describe("credits are never a punishment", () => {
  it("exposes no deduction or penalty function", () => {
    const names = Object.keys(credits).map((n) => n.toLowerCase());
    for (const bad of ["deduct", "penal", "confiscat", "revoke", "remove", "fine"]) {
      expect(names.some((n) => n.includes(bad))).toBe(false);
    }
  });

  it("rejects any debit that is not a mini-course unlock at the database level", () => {
    expect(() =>
      db.run(
        `INSERT INTO credit_transactions (id, user_id, amount, kind, reason, source_type, source_id, idempotency_key) VALUES ('p1', 'usr_alex', -10, 'redeem', 'Absence penalty', 'volunteering', 'x', 'penalty:1')`,
      ),
    ).toThrow();
    expect(() =>
      db.run(
        `INSERT INTO credit_transactions (id, user_id, amount, kind, reason, source_type, source_id, idempotency_key) VALUES ('p2', 'usr_alex', -10, 'penalty', 'Behaviour', 'discipline', 'x', 'penalty:2')`,
      ),
    ).toThrow();
  });

  it("prevents overdrafts and edits to the ledger", () => {
    expect(() =>
      db.run(
        `INSERT INTO credit_transactions (id, user_id, amount, kind, reason, source_type, source_id, idempotency_key) VALUES ('o1', 'usr_alex', -1000, 'redeem', 'x', 'course_unlock', 'first-aid', 'redeem:overdraft')`,
      ),
    ).toThrow(/insufficient credits/);
    expect(() => db.run(`UPDATE credit_transactions SET amount = 0`)).toThrow(/append-only/);
    expect(() => db.run(`DELETE FROM credit_transactions`)).toThrow(/append-only/);
  });

  it("no longer accepts voucher debits (the shop was removed)", () => {
    expect(() =>
      db.run(
        `INSERT INTO credit_transactions (id, user_id, amount, kind, reason, source_type, source_id, idempotency_key) VALUES ('v1', 'usr_alex', -10, 'redeem', 'x', 'voucher_redemption', 'x', 'redeem:legacy')`,
      ),
    ).toThrow(/removed/);
    expect(db.get(`SELECT name FROM sqlite_master WHERE name IN ('reward_offers','voucher_redemptions','reward_partners')`)).toBeUndefined();
  });

  it("marking a student as not attended never removes existing credits", () => {
    const before = creditBalance(db, "usr_alex");
    verifyParticipation(db, actor(db, "usr_novak"), "reg_alex_act_lab2", false);
    expect(creditBalance(db, "usr_alex")).toBe(before);
  });
});
