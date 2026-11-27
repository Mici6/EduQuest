import "server-only";
import { SESSION_MAX_AGE_S } from "./token";

export { SESSION_COOKIE, createSessionToken, verifySessionToken } from "./token";

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_S,
};
