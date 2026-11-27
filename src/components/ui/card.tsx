import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/format";

type Tone = "default" | "flat" | "sun" | "ember" | "iris" | "outline";

const TONE: Record<Tone, string> = {
  default: "surface",
  flat: "surface-flat",
  sun: "grad-sun text-ink-950 border border-sun-200/40",
  ember: "grad-ember text-ink-950 border border-amber/40",
  iris: "grad-iris text-ink-950 border border-iris-300/40",
  outline: "border border-dashed border-line-strong bg-transparent",
};

export function Card({ tone = "default", className, children, ...rest }: HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return (
    <div className={cn("min-w-0 rounded-[var(--radius-card)] p-5 sm:p-6", TONE[tone], className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? <div className="mt-0.5 shrink-0">{icon}</div> : null}
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold leading-tight sm:text-lg">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-fg-3">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Round icon chip used as a card/section marker. */
export function IconChip({ children, tone = "sun", className }: { children: ReactNode; tone?: "sun" | "iris" | "ember" | "mint" | "neutral" | "rose" | "sky"; className?: string }) {
  const tones = {
    sun: "bg-sun-300/15 text-sun-200",
    iris: "bg-iris-400/15 text-iris-200",
    ember: "bg-ember/15 text-amber",
    mint: "bg-mint/15 text-mint",
    rose: "bg-rose/15 text-rose",
    sky: "bg-sky/15 text-sky",
    neutral: "bg-white/[0.06] text-fg-2",
  };
  return <span className={cn("inline-flex size-9 items-center justify-center rounded-full [&_svg]:size-[18px]", tones[tone], className)}>{children}</span>;
}
