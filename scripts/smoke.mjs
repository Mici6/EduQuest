#!/usr/bin/env node
/**
 * Route smoke test against a running EduQuest server (demo mode).
 * Signs in as each demo persona (by minting a session cookie with the local
 * demo secret), requests every page for that role, and checks that pages of
 * other roles redirect away. Usage: node scripts/smoke.mjs [baseUrl]
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3100";
const secret = fs.readFileSync(path.join(process.cwd(), ".data", "session-secret"), "utf8").trim();

const ROLE = { usr_alex: "student", usr_novak: "teacher", usr_ionescu: "admin", usr_adeyemi: "support" };

function token(uid) {
  const payload = Buffer.from(JSON.stringify({ uid, role: ROLE[uid], exp: Date.now() + 3600_000 })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

const ROUTES = {
  usr_alex: [
    "/app/dashboard", "/app/catalog", "/app/catalog?tab=attendance", "/app/catalog?tab=announcements", "/app/catalog?tab=teachers", "/app/catalog?tab=stats",
    "/app/homework", "/app/schedule", "/app/study", "/app/study/chat", "/app/study/summary", "/app/study/quiz", "/app/study/quiz?kind=practice_test",
    "/app/study/homework", "/app/study/plan", "/app/flashcards", "/app/flashcards/set_photo", "/app/quizzes", "/app/quizzes/quiz_linear",
    "/app/library", "/app/library/doc_photosynthesis", "/app/volunteering", "/app/rewards", "/app/rewards?tab=wallet", "/app/rewards?tab=history",
    "/app/progress", "/app/notifications", "/app/settings",
  ],
  usr_novak: [
    "/app/teacher", "/app/teacher/classes", "/app/teacher/classes/cls_10a?subject=sub_mat", "/app/teacher/attendance", "/app/teacher/assignments",
    "/app/teacher/assignments/asg_10A_MAT_1", "/app/teacher/studio", "/app/teacher/studio?tab=drafts", "/app/teacher/announcements",
    "/app/teacher/volunteering", "/app/library", "/app/schedule", "/app/notifications", "/app/settings", "/app/quizzes/quiz_draft_gradients",
  ],
  usr_ionescu: [
    "/app/admin", "/app/admin/people", "/app/admin/people?role=teacher&q=a", "/app/admin/classes", "/app/admin/announcements", "/app/admin/volunteering",
    "/app/admin/rewards", "/app/admin/plans", "/app/admin/audit", "/app/admin/settings", "/app/library", "/app/notifications", "/app/settings",
  ],
  usr_adeyemi: ["/app/support", "/app/support?status=all", "/app/support/caseload", "/app/support/plans", "/app/support/plans/pln_lina", "/app/notifications", "/app/settings"],
};

// Pages each persona must NOT be able to open (expect a redirect away).
const FORBIDDEN = {
  usr_alex: ["/app/teacher", "/app/admin", "/app/support", "/app/support/plans/pln_lina", "/app/teacher/studio"],
  usr_novak: ["/app/admin", "/app/support", "/app/support/plans/pln_lina", "/app/dashboard", "/app/rewards"],
  usr_ionescu: ["/app/support", "/app/support/plans/pln_lina", "/app/teacher", "/app/study"],
  usr_adeyemi: ["/app/admin", "/app/teacher", "/app/dashboard", "/app/library"],
};

let failures = 0;
const t0 = Date.now();
for (const [uid, routes] of Object.entries(ROUTES)) {
  const cookie = `eq_session=${token(uid)}`;
  for (const r of routes) {
    const res = await fetch(base + r, { headers: { cookie }, redirect: "manual" });
    const html = res.status === 200 ? await res.text() : "";
    // Errors, notFound() and in-stream redirects all surface as a digest template.
    // Client-only chart islands intentionally emit a "switched to client rendering" bailout.
    const templates = [...html.matchAll(/<template data-dgst="([^"]*)"(?: data-msg="([^"]*)")?/g)];
    const broken =
      res.status !== 200 ||
      templates.some(([, digest, msg]) => !(digest === "BAILOUT_TO_CLIENT_SIDE_RENDERING" || (msg ?? "").startsWith("Switched to client rendering")));
    if (broken) failures++;
    console.log(`${broken ? "FAIL" : "ok  "} ${res.status} ${uid.padEnd(12)} ${r}`);
  }
  for (const r of FORBIDDEN[uid]) {
    const res = await fetch(base + r, { headers: { cookie }, redirect: "manual" });
    const loc = res.headers.get("location") ?? "";
    const blocked = [303, 307, 308].includes(res.status) && !loc.endsWith(r);
    if (!blocked) failures++;
    console.log(`${blocked ? "ok  " : "FAIL"} ${res.status} ${uid.padEnd(12)} ${r} → denied${loc ? ` (${loc})` : ""}`);
  }
}
// Unauthenticated access redirects to sign-in; public pages load.
for (const r of ["/app/dashboard", "/app/admin"]) {
  const res = await fetch(base + r, { redirect: "manual" });
  const ok = [303, 307].includes(res.status) && (res.headers.get("location") ?? "").includes("/login");
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${res.status} anonymous    ${r} → /login`);
}
for (const r of ["/", "/login", "/api/health"]) {
  const res = await fetch(base + r);
  if (res.status !== 200) failures++;
  console.log(`${res.status === 200 ? "ok  " : "FAIL"} ${res.status} public       ${r}`);
}
console.log(`\n${failures ? `${failures} FAILURES` : "All routes OK"} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(failures ? 1 : 0);
