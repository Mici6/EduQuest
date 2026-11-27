import type { ReactNode } from "react";
import { cn } from "@/lib/utils/format";

export function PageHeader({ eyebrow, title, description, actions, className }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-sun-300/90">{eyebrow}</p> : null}
        <h1 className="font-display text-[28px] font-semibold leading-[1.1] sm:text-[34px]">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-fg-2 sm:text-[15px]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
