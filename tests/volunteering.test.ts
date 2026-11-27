import { beforeEach, describe, expect, it } from "vitest";
import { actor, seededDb } from "./support/db";
import type { Db } from "../src/lib/db/client";
import { cancelRegistration, creditBalance, listActivities, registerForActivity, verifyParticipation, createActivity } from "../src/lib/domain/credits";
import { DomainError } from "../src/lib/auth/errors";

let db: Db;
beforeEach(() => {
  db = seededDb();
});

describe("volunteering", () => {
  it("registers once, prevents duplicates and allows cancellation before the start", () => {
    const alex = actor(db, "usr_alex");
    registerForActivity(db, alex, "act_recycling");
    expect(() => registerForActivity(db, alex, "act_recycling")).toThrow(/already registered/);
    cancelRegistration(db, alex, "act_recycling");
    expect(listActivities(db, alex).find((a) => a.id === "act_recycling")!.my_status).toBe("cancelled");
    registerForActivity(db, alex, "act_recycling");
    expect(listActivities(db, alex).find((a) => a.id === "act_recycling")!.my_status).toBe("registered");
  });

  it("respects capacity and closed activities", () => {
    db.run(`UPDATE volunteering_activities SET capacity = 1 WHERE id = 'act_reading'`);
    registerForActivity(db, actor(db, "usr_maya"), "act_reading");
    expect(() => registerForActivity(db, actor(db, "usr_alex"), "act_reading")).toThrow(/full/);
    expect(() => registerForActivity(db, actor(db, "usr_alex"), "act_lab2")).toThrow(/closed/);
  });

  it("credits only verified participation, exactly once", () => {
    const novak = actor(db, "usr_novak");
    const before = creditBalance(db, "usr_alex");
    expect(verifyParticipation(db, novak, "reg_alex_act_lab2", true).credited).toBe(25);
    expect(verifyParticipation(db, novak, "reg_alex_act_lab2", true)).toMatchObject({ credited: 0, alreadyVerified: true });
    expect(creditBalance(db, "usr_alex")).toBe(before + 25);
  });

  it("only the organiser (or a school admin) can verify", () => {
    expect(() => verifyParticipation(db, actor(db, "usr_okafor"), "reg_alex_act_lab2", true)).toThrow(DomainError);
    expect(() => verifyParticipation(db, actor(db, "usr_alex"), "reg_alex_act_lab2", true)).toThrow(DomainError);
    expect(verifyParticipation(db, actor(db, "usr_ionescu"), "reg_alex_act_lab2", true).credited).toBe(25);
  });

  it("cannot verify before an activity starts", () => {
    const alex = actor(db, "usr_alex");
    const regId = registerForActivity(db, alex, "act_recycling");
    expect(() => verifyParticipation(db, actor(db, "usr_sato"), regId, true)).toThrow(/once the activity has started/);
  });

  it("validates new activities", () => {
    const novak = actor(db, "usr_novak");
    expect(() => createActivity(db, novak, { title: "x", description: "d", category: "School", location: "Hall", startsAt: new Date().toISOString(), durationMinutes: 60, capacity: 5, credits: 10 })).toThrow(DomainError);
    expect(() => createActivity(db, actor(db, "usr_alex"), { title: "Valid title", description: "d", category: "School", location: "Hall", startsAt: new Date().toISOString(), durationMinutes: 60, capacity: 5, credits: 10 })).toThrow(DomainError);
    expect(createActivity(db, novak, { title: "Garden tidy-up", description: "Help", category: "Community", location: "Garden", startsAt: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 60, capacity: 5, credits: 10 })).toMatch(/^act_/);
  });
});
