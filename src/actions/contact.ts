"use server";

import { invalid } from "@/lib/auth/errors";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/client";
import { rateLimit } from "@/lib/http";
import { headers } from "next/headers";
import { attempt } from "./_run";

/** Public "request a demo / partnership" form. Stores the minimum needed to reply. */
export async function submitContactAction(input: { name: string; email: string; organisation: string; role: string; message: string; consent: boolean }) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return attempt(() => {
    if (!rateLimit(`contact:${ip}`, 5, 60 * 60 * 1000)) throw invalid("Too many requests — please try again later.");
    const name = String(input.name ?? "").trim();
    const email = String(input.email ?? "").trim().toLowerCase();
    const organisation = String(input.organisation ?? "").trim();
    const role = String(input.role ?? "");
    if (name.length < 2 || name.length > 80) throw invalid("Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) throw invalid("Please enter a valid email address.");
    if (organisation.length < 2 || organisation.length > 120) throw invalid("Please enter your school or organisation.");
    if (!["school_leader", "teacher", "business", "ngo", "parent_student", "other"].includes(role)) throw invalid("Please choose who you are.");
    if (input.consent !== true) throw invalid("Please confirm we may use these details to reply to you.");
    getDb().run(
      `INSERT INTO contact_requests (id, name, email, organisation, role, message, consent_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      newId("ctc_"),
      name,
      email,
      organisation,
      role,
      String(input.message ?? "").trim().slice(0, 2000) || null,
    );
    return true;
  });
}
