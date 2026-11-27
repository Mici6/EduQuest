"use client";

import type { ReactNode } from "react";
import { Tooltip as TooltipRoot, TooltipContent, TooltipTrigger } from "@/components/shadcn/tooltip";
import { cn } from "@/lib/utils/format";

/** Tooltip (shadcn/ui on Base UI) shown on hover and keyboard focus; 125ms ease-out from scale 0.97. */
export function Tooltip({ content, children, className, side = "top" }: { content: ReactNode; children: ReactNode; className?: string; side?: "top" | "bottom" }) {
  return (
    <TooltipRoot>
      <TooltipTrigger render={<span tabIndex={0} className={cn("inline-flex rounded-full", className)} />}>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={6} className="max-w-56 rounded-xl border border-line bg-ink-950 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-fg shadow-xl duration-[125ms] ease-out data-open:zoom-in-[0.97] data-closed:zoom-out-[0.97] [&>div[data-side]]:hidden">
        {content}
      </TooltipContent>
    </TooltipRoot>
  );
}
