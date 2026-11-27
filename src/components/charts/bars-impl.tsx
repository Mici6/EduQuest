"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, GRID, SERIES, SINGLE, SURFACE } from "./palette";
import { ChartTooltip } from "./tooltip";

export type BarSeries = { key: string; name: string };

export default function BarsImpl({
  data,
  xKey,
  series,
  height,
  domain,
  suffix,
  highlightLast,
}: {
  data: Record<string, string | number | null>[];
  xKey: string;
  series: BarSeries[];
  height: number;
  domain?: [number, number];
  suffix?: string;
  highlightLast?: boolean;
}) {
  const stacked = series.length > 1;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
        <YAxis domain={domain} allowDecimals={false} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
        <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<ChartTooltip format={(v) => `${v}${suffix ?? ""}`} />} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stackId={stacked ? "a" : undefined}
            fill={stacked ? SERIES[i] : SINGLE}
            stroke={SURFACE}
            strokeWidth={stacked ? 2 : 0}
            radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]) : [4, 4, 0, 0]}
            maxBarSize={36}
          >
            {!stacked && highlightLast
              ? data.map((_, di) => <Cell key={di} fill={di === data.length - 1 ? SINGLE : "rgba(255,211,77,0.45)"} />)
              : null}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
