import path from "node:path";

/**
 * Where the database, uploads and generated secret live.
 * Serverless hosts (Vercel) only allow writing to /tmp, and wipe it from
 * time to time, so the demo there resets; use a persistent disk for real data.
 * Shared by the proxy and the server, so it must not import `server-only`.
 */
export function dataDirPath(): string {
  if (process.env.EDUQUEST_DATA_DIR) return process.env.EDUQUEST_DATA_DIR;
  if (process.env.VERCEL) return "/tmp/eduquest";
  return path.join(process.cwd(), ".data");
}
