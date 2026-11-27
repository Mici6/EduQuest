import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/format";

/** URL-driven pill navigation (works without JavaScript, shareable state). */
export function LinkTabs({ items, label, className }: { items: { href: string; label: ReactNode; active: boolean; count?: number }[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("scrollbar-none inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-ink-900/80 p-1", className)}>
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          scroll={false}
          aria-current={it.active ? "page" : undefined}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors",
            it.active ? "bg-sun-200 text-ink-950 shadow-[0_6px_18px_-8px_rgb(255_211_77/0.7)]" : "text-fg-2 hover:bg-white/[0.06] hover:text-fg",
          )}
        >
          {it.label}
          {it.count != null ? <span className={cn("rounded-full px-1.5 text-[10px] tabular-nums", it.active ? "bg-ink-950/15" : "bg-white/10")}>{it.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
