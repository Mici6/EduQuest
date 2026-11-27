import type { ReactNode } from "react";
import { cn } from "@/lib/utils/format";

export function ProgressBar({
  value,
  className,
  tone = "sun",
  label,
  size = "md",
}: {
  value: number; // 0..1
  className?: string;
  tone?: "sun" | "ember" | "iris" | "mint" | "dark";
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const fill = {
    sun: "bg-gradient-to-r from-sun-100 to-sun-300",
    ember: "bg-gradient-to-r from-sun-300 to-ember",
    iris: "bg-gradient-to-r from-iris-300 to-iris-600",
    mint: "bg-mint",
    dark: "bg-ink-950",
  }[tone];
  const h = { sm: "h-1.5", md: "h-2", lg: "h-3" }[size];
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full", tone === "dark" ? "bg-ink-950/15" : "bg-white/[0.07]", h, className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 72,
  stroke = 7,
  children,
  tone = "sun",
  label,
  className,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  children?: ReactNode;
  tone?: "sun" | "iris" | "ember" | "mint" | "dark";
  label?: string;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const color = { sun: "var(--color-sun-300)", iris: "var(--color-iris-400)", ember: "var(--color-ember)", mint: "var(--color-mint)", dark: "var(--color-ink-950)" }[tone];
  const track = tone === "dark" ? "rgb(8 11 18 / 0.15)" : "rgb(255 255 255 / 0.08)";
  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v * 100)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.2,0.7,0.2,1)" }}
        />
      </svg>
      {children ? <div className="absolute inset-0 grid place-items-center text-center">{children}</div> : null}
    </div>
  );
}
