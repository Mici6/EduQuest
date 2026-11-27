"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils/format";

export type TabItem<T extends string> = { value: T; label: ReactNode; count?: number };

/** Segmented "pill" tabs (keyboard: ←/→/Home/End). */
export function PillTabs<T extends string>({
  items,
  value,
  onChange,
  className,
  size = "md",
  label,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
  label: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const last = items.length - 1;
    const next = e.key === "ArrowRight" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (next == null) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(items[next]!.value);
  };
  return (
    <div role="tablist" aria-label={label} className={cn("scrollbar-none inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-ink-900/80 p-1", className)}>
      {items.map((it, i) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => onChange(it.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold transition-colors",
              size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm",
              active ? "bg-sun-200 text-ink-950 shadow-[0_6px_18px_-8px_rgb(255_211_77/0.7)]" : "text-fg-2 hover:bg-white/[0.06] hover:text-fg",
            )}
          >
            {it.label}
            {it.count != null ? (
              <span className={cn("rounded-full px-1.5 text-[10px] tabular-nums", active ? "bg-ink-950/15" : "bg-white/10")}>{it.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
