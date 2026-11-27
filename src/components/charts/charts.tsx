"use client";

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { Table2 } from "lucide-react";
import { Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils/format";
import { SERIES } from "./palette";
import type { BarSeries } from "./bars-impl";
import type { TrendPoint } from "./trend-impl";

// Recharts is heavy: load it only in the browser, after the page shell.
const TrendImpl = dynamic(() => import("./trend-impl"), { ssr: false, loading: () => <Skeleton className="h-full w-full" /> });
const BarsImpl = dynamic(() => import("./bars-impl"), { ssr: false, loading: () => <Skeleton className="h-full w-full" /> });

function Frame({
  title,
  description,
  children,
  table,
  height,
  legend,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  table: { headers: string[]; rows: (string | number)[][] };
  height: number;
  legend?: ReactNode;
  className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className={cn("min-w-0", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <figcaption className="min-w-0">
          <p className="font-display text-base font-semibold">{title}</p>
          {description ? <p className="mt-0.5 text-xs text-fg-3">{description}</p> : null}
        </figcaption>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-fg-2 hover:text-fg"
        >
          <Table2 className="size-3.5" aria-hidden /> {asTable ? "Chart" : "Table"}
        </button>
      </div>
      {legend && !asTable ? <div className="mb-3">{legend}</div> : null}
      {asTable ? (
        <div className="overflow-x-auto rounded-2xl border border-line" style={{ maxHeight: height + 40 }}>
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-ink-850 text-fg-3">
              <tr>
                {table.headers.map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-t border-line/70">
                  {r.map((c, j) => (
                    <td key={j} className={cn("px-3 py-1.5", j > 0 && "tabular-nums")}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height }} aria-hidden>
          {children}
        </div>
      )}
    </figure>
  );
}

export function TrendChart({
  title,
  description,
  data,
  domain,
  name,
  height = 220,
  suffix,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  data: TrendPoint[];
  domain: [number, number];
  name: string;
  height?: number;
  suffix?: string;
  className?: string;
}) {
  return (
    <Frame title={title} description={description} height={height} className={className} table={{ headers: ["Period", name], rows: data.map((d) => [d.label, d.value == null ? "—" : `${d.value}${suffix ?? ""}`]) }}>
      <TrendImpl data={data} domain={domain} name={name} height={height} suffix={suffix} />
    </Frame>
  );
}

export function BarsChart({
  title,
  description,
  data,
  xKey,
  series,
  height = 220,
  domain,
  suffix,
  highlightLast,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  data: Record<string, string | number | null>[];
  xKey: string;
  series: BarSeries[];
  height?: number;
  domain?: [number, number];
  suffix?: string;
  highlightLast?: boolean;
  className?: string;
}) {
  const legend =
    series.length > 1 ? (
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-2">
        {series.map((s, i) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: SERIES[i] }} aria-hidden />
            {s.name}
          </li>
        ))}
      </ul>
    ) : null;
  return (
    <Frame
      title={title}
      description={description}
      height={height}
      legend={legend}
      className={className}
      table={{ headers: [xKey === "label" ? "Period" : xKey, ...series.map((s) => s.name)], rows: data.map((d) => [String(d[xKey]), ...series.map((s) => (d[s.key] == null ? "—" : `${d[s.key]}${suffix ?? ""}`))]) }}
    >
      <BarsImpl data={data} xKey={xKey} series={series} height={height} domain={domain} suffix={suffix} highlightLast={highlightLast} />
    </Frame>
  );
}
