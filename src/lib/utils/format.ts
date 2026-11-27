import { toDate } from "./dates";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function fmtGrade(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toFixed(2).replace(/\.?0+$/, (m) => (m.startsWith(".") ? "" : m));
}

export function fmtNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function fmtDate(value: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }): string {
  return new Intl.DateTimeFormat("en-GB", opts).format(toDate(value));
}

/** Day, month and year: for official documents (passports, certificates, letters). */
export const fmtDateLong = (value: string) => fmtDate(value, { day: "numeric", month: "long", year: "numeric" });

export function fmtDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(toDate(value));
}

export function relativeTime(value: string, now = new Date()): string {
  const diff = (toDate(value).getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return fmtDate(value);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function pct(part: number, total: number): number {
  return total <= 0 ? 0 : Math.round((part / total) * 100);
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
