import type { ReactNode } from "react";
import { cn } from "@/lib/utils/format";

export function EmptyState({ icon, title, children, action, className }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("grid-dots flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line px-6 py-10 text-center", className)}>
      {icon ? <div className="mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-white/[0.05] text-fg-2 [&_svg]:size-6">{icon}</div> : null}
      <p className="font-display text-base font-semibold">{title}</p>
      {children ? <div className="mt-1.5 max-w-sm text-sm text-fg-3">{children}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-2xl", className)} aria-hidden />;
}

export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("surface rounded-[var(--radius-card)] p-6", className)} aria-hidden>
      <Skeleton className="mb-4 h-5 w-1/3" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("mb-2.5 h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function Notice({ tone = "info", title, children, icon, className }: { tone?: "info" | "warn" | "ai" | "danger" | "success"; title?: ReactNode; children?: ReactNode; icon?: ReactNode; className?: string }) {
  const tones = {
    info: "border-sky/25 bg-sky/[0.07] text-sky",
    warn: "border-amber/30 bg-amber/[0.08] text-amber",
    ai: "border-iris-400/30 bg-iris-400/[0.08] text-iris-200",
    danger: "border-rose/30 bg-rose/[0.08] text-rose",
    success: "border-mint/30 bg-mint/[0.08] text-mint",
  };
  return (
    <div className={cn("flex gap-3 rounded-2xl border px-4 py-3 text-sm", tones[tone], className)} role={tone === "danger" ? "alert" : "note"}>
      {icon ? <div className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</div> : null}
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-fg-2 [&_a]:underline [&_a]:underline-offset-2">{children}</div> : null}
      </div>
    </div>
  );
}
