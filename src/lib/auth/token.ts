import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dataDirPath } from "../config/data-dir";
import type { Role } from "./types";

/**
 * Signed session tokens (HMAC-SHA256). Shared by the request proxy and the
 * server runtime, so this module must not import `server-only`.
 */
export const SESSION_COOKIE = "eq_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 12;

let cachedSecret: string | undefined;

/** Production must set SESSION_SECRET (≥32 chars). Demo mode generates one in `.data/`. */
function secret(): string {
  if (cachedSecret) return cachedSecret;
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) {
    cachedSecret = process.env.SESSION_SECRET;
    return cachedSecret;
  }
  if (process.env.VERCEL) {
    // Each serverless instance would generate its own secret, so logins and document seals wouldn't match across them.
    console.warn("[auth] SESSION_SECRET is missing or shorter than 32 characters; set it in the host's environment variables.");
  }
  const dir = dataDirPath();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "session-secret");
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(48).toString("base64url"), { mode: 0o600 });
  cachedSecret = fs.readFileSync(file, "utf8").trim();
  return cachedSecret;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Seal for school-issued documents; the prefix keeps it from ever matching a session signature. */
export function sealSignature(data: string): string {
  return sign(`credential:v1:${data}`);
}

export function sealMatches(data: string, signature: string): boolean {
  const a = Buffer.from(signature);
  const b = Buffer.from(sealSignature(data));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export type SessionClaims = { uid: string; role: Role };

export function createSessionToken(uid: string, role: Role, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ uid, role, exp: now + SESSION_MAX_AGE_S * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): SessionClaims | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { uid: string; role: Role; exp: number };
    if (typeof data.uid !== "string" || typeof data.role !== "string" || data.exp < now) return null;
    return { uid: data.uid, role: data.role };
  } catch {
    return null;
  }
}
