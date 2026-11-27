import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { dataDir } from "../db/client";

/**
 * Storage adapter. Demo mode writes to `.data/uploads`. A production
 * deployment swaps this for a private Supabase Storage bucket (see docs).
 */
export async function putObject(key: string, data: Uint8Array): Promise<void> {
  const file = resolveKey(key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data, { mode: 0o600 });
}

export async function getObject(key: string): Promise<Buffer> {
  return fs.readFile(resolveKey(key));
}

function resolveKey(key: string): string {
  const root = path.join(dataDir(), "uploads");
  const file = path.resolve(root, key);
  if (!file.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return file;
}
