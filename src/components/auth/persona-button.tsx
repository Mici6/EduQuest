"use client";

import { useTransition, type ReactNode } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { signInDemo } from "@/actions/auth";
import { cn } from "@/lib/utils/format";

export function PersonaButton({ userId, children, className, compact }: { userId: string; children: ReactNode; className?: string; compact?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => signInDemo(userId))}
      disabled={pending}
      aria-busy={pending || undefined}
      className={cn(
        "group flex w-full items-center gap-3 text-left transition-all disabled:opacity-70",
        compact ? "rounded-2xl px-3 py-2.5 hover:bg-white/[0.05]" : "surface rounded-[22px] p-4 hover:-translate-y-0.5 hover:border-line-strong",
        className,
      )}
    >
      <span className="min-w-0 flex-1">{children}</span>
      <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full transition-colors", compact ? "size-8 text-fg-3 group-hover:text-fg" : "size-10 bg-white/[0.06] text-fg-2 group-hover:bg-sun-200 group-hover:text-ink-950")}>
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
      </span>
    </button>
  );
}
