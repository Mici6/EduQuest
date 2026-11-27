import type { Role } from "./types";

export function homeFor(role: Role): string {
  return { student: "/app/dashboard", teacher: "/app/teacher", admin: "/app/admin", support: "/app/support" }[role];
}

/**
 * Coarse route → role map used by the request proxy for early redirects.
 * Every page and domain function still performs its own server-side checks.
 */
const RULES: [prefix: string, roles: Role[]][] = [
  ["/app/teacher", ["teacher"]],
  ["/app/admin", ["admin"]],
  ["/app/support", ["support"]],
  ["/app/quizzes/", ["student", "teacher"]],
  ["/app/flashcards/", ["student", "teacher"]],
  ["/app/dashboard", ["student"]],
  ["/app/catalog", ["student"]],
  ["/app/homework", ["student"]],
  ["/app/study", ["student"]],
  ["/app/flashcards", ["student"]],
  ["/app/quizzes", ["student"]],
  ["/app/volunteering", ["student"]],
  ["/app/courses", ["student"]],
  ["/app/passport", ["student"]],
  ["/app/progress", ["student"]],
  ["/app/schedule", ["student", "teacher"]],
  ["/app/library", ["student", "teacher", "admin"]],
];

export function allowedRoles(pathname: string): Role[] | null {
  for (const [prefix, roles] of RULES) {
    if (prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(prefix + "/")) return roles;
  }
  return null; // shared pages: /app, notifications, settings
}
