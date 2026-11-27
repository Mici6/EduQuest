"use client";

import { useId } from "react";
import { Switch as ShadSwitch } from "@/components/shadcn/switch";
import { cn } from "@/lib/utils/format";

/** Labelled toggle (shadcn/ui on Base UI). */
export function Switch({ checked, onChange, label, description, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean; id?: string }) {
  const fallback = useId();
  const sid = id ?? fallback;
  return (
    <div className={cn("flex items-start justify-between gap-4 py-3", disabled && "opacity-60")}>
      <label htmlFor={sid} className={cn("min-w-0 cursor-pointer", disabled && "cursor-not-allowed")}>
        <span className="block text-sm font-medium">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-fg-3">{description}</span> : null}
      </label>
      <ShadSwitch
        id={sid}
        checked={checked}
        onCheckedChange={(v) => onChange(v)}
        disabled={disabled}
        aria-label={label}
        className="mt-0.5 !h-6 !w-11 transition-colors duration-200 ease-out data-unchecked:bg-ink-700 data-unchecked:ring-1 data-unchecked:ring-inset data-unchecked:ring-line-strong data-checked:bg-sun-300 [&>span]:!size-5 [&>span]:bg-white [&>span]:shadow [&>span]:duration-200 [&>span]:ease-out [&>span]:data-checked:!translate-x-[22px] [&>span]:data-unchecked:!translate-x-0.5"
      />
    </div>
  );
}
