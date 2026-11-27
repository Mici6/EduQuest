import type { ReactNode } from "react";
import { cn } from "@/lib/utils/format";

export type Tone = "neutral" | "sun" | "ember" | "iris" | "mint" | "rose" | "sky" | "solid" | "dark";

const TONES: Record<Tone, string> = {
  neutral: "bg-white/[0.06] text-fg-2 ring-white/10",
  sun: "bg-sun-300/15 text-sun-200 ring-sun-300/25",
  ember: "bg-ember/15 text-amber ring-ember/25",
  iris: "bg-iris-400/15 text-iris-200 ring-iris-400/25",
  mint: "bg-mint/15 text-mint ring-mint/25",
  rose: "bg-rose/15 text-rose ring-rose/25",
  sky: "bg-sky/15 text-sky ring-sky/25",
  solid: "bg-sun-200 text-ink-950 ring-transparent",
  dark: "bg-ink-950/80 text-fg ring-white/10",
};

export function Badge({ tone = "neutral", children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap [&_svg]:size-3", TONES[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

/** Coloured dot + name for subjects (colour comes from the database). */
export function SubjectTag({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-fg-2", className)}>
      <span className="size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      {name}
    </span>
  );
}
