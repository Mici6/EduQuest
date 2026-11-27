"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { cn } from "@/lib/utils/format";

/**
 * Dropdown menu (shadcn/ui on Base UI): keyboard navigation, focus return,
 * Escape and outside-click to close. Opens from the trigger's side
 * (transform-origin) in 200ms ease-out, closes faster.
 */
export function Menu({ trigger, children, align = "end", label, className }: { trigger: ReactNode; children: (close: () => void) => ReactNode; align?: "start" | "end"; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger aria-label={label} className={cn("rounded-full", className)}>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        sideOffset={8}
        className="w-auto min-w-56 rounded-2xl bg-ink-850 p-1.5 text-fg shadow-2xl ring-line duration-200 ease-out data-closed:duration-150"
      >
        {children(() => setOpen(false))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A menu entry. Pass `render` (e.g. `<Link href="…" />`) to make it a link. */
export function MenuItem({ children, onClick, icon, danger, disabled, render }: { children: ReactNode; onClick?: () => void; icon?: ReactNode; danger?: boolean; disabled?: boolean; render?: ReactElement }) {
  return (
    <DropdownMenuItem
      variant={danger ? "destructive" : "default"}
      disabled={disabled}
      onClick={onClick}
      render={render}
      className={cn("gap-2.5 rounded-xl px-3 py-2 text-fg-2 transition-colors focus:bg-white/[0.06] focus:text-fg [&_svg]:size-4", danger && "text-rose")}
    >
      {icon}
      {children}
    </DropdownMenuItem>
  );
}
