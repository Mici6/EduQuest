/** Local-date helpers. All stored dates are ISO `YYYY-MM-DD` strings. */

export function isoDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIso(date: string): Date {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

/** Monday = 1 … Sunday = 7 */
export function weekday(d: Date = new Date()): number {
  const w = d.getDay();
  return w === 0 ? 7 : w;
}

export function startOfWeek(d: Date = new Date()): Date {
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), 1 - weekday(d));
}

/** ISO-8601 week key, e.g. 2026-W47. */
export function isoWeekKey(d: Date = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function periodKey(cadence: "daily" | "weekly", d: Date = new Date()): string {
  return cadence === "daily" ? isoDate(d) : isoWeekKey(d);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((parseIso(isoDate(b)).getTime() - parseIso(isoDate(a)).getTime()) / 86400000);
}

/** SQLite `datetime('now')` style UTC timestamp. */
export function nowTs(d: Date = new Date()): string {
  return d.toISOString().replace("T", " ").slice(0, 19);
}

export function toDate(ts: string): Date {
  // Accept both `YYYY-MM-DD HH:MM:SS` (UTC) and ISO strings.
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(ts)) return new Date(ts.replace(" ", "T") + "Z");
  if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) return parseIso(ts);
  return new Date(ts);
}
