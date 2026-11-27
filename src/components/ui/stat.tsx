import type { ReactNode } from "react";
import { cn } from "@/lib/utils/format";

export function StatCard({
  label,
  value,
  hint,
  icon,
  trend,
  className,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  trend?: { value: string; direction: "up" | "down" | "flat"; good?: boolean } | null;
  className?: string;
  accent?: "sun" | "iris" | "ember" | "mint";
}) {
  const accentRing = accent ? { sun: "before:bg-sun-300", iris: "before:bg-iris-400", ember: "before:bg-ember", mint: "before:bg-mint" }[accent] : "";
  return (
    <div
      className={cn(
        "surface relative min-w-0 overflow-hidden rounded-[22px] p-3 sm:p-5",
        accent && "before:absolute before:-right-6 before:-top-6 before:size-20 before:rounded-full before:opacity-20 before:blur-2xl",
        accentRing,
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium leading-tight text-fg-3 sm:text-xs">{label}</p>
        {icon ? <span className="hidden text-fg-3 sm:inline [&_svg]:size-4">{icon}</span> : null}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <p className="font-display text-lg font-semibold leading-tight tabular-nums [overflow-wrap:anywhere] sm:text-[28px]">{value}</p>
        {trend ? (
          <span
            className={cn(
              "mb-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
              trend.direction === "flat" ? "bg-white/10 text-fg-2" : trend.good ? "bg-mint/20 text-mint" : "bg-rose/20 text-rose",
            )}
          >
            {trend.value}
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-1 text-xs text-fg-3">{hint}</p> : null}
    </div>
  );
}
