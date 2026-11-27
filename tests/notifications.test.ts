import { beforeEach, describe, expect, it } from "vitest";
import { actor, seededDb } from "./support/db";
import type { Db } from "../src/lib/db/client";
import { listNotifications, markAllRead, notify, saveUserSettings, unreadCount } from "../src/lib/domain/notifications";

let db: Db;
beforeEach(() => {
  db = seededDb();
});

describe("notifications", () => {
  it("respects category preferences (system notices always deliver)", () => {
    const alex = actor(db, "usr_alex");
    saveUserSettings(db, alex, { notifications: { rewards: false, system: false } });
    expect(notify(db, alex.id, { category: "rewards", title: "x", body: "y" })).toBe(false);
    expect(notify(db, alex.id, { category: "system", title: "Security", body: "y" })).toBe(true);
  });

  it("de-duplicates and caps low-value categories per day", () => {
    const alex = actor(db, "usr_alex");
    expect(notify(db, alex.id, { category: "academic", title: "a", body: "b", dedupeKey: "k1" })).toBe(true);
    expect(notify(db, alex.id, { category: "academic", title: "a", body: "b", dedupeKey: "k1" })).toBe(false);
    let sent = 0;
    for (let i = 0; i < 10; i++) if (notify(db, alex.id, { category: "gamification", title: `g${i}`, body: "b" })) sent++;
    expect(sent).toBeLessThanOrEqual(4);
  });

  it("tracks read state per user", () => {
    const alex = actor(db, "usr_alex");
    expect(unreadCount(db, alex)).toBeGreaterThan(0);
    markAllRead(db, alex);
    expect(unreadCount(db, alex)).toBe(0);
    expect(listNotifications(db, actor(db, "usr_maya")).every((n) => n.title)).toBe(true);
  });
});
