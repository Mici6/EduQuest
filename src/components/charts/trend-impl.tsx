"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, GRID, SINGLE } from "./palette";
import { ChartTooltip } from "./tooltip";

export type TrendPoint = { label: string; value: number | null };

export default function TrendImpl({ data, domain, name, height, suffix, color = SINGLE }: { data: TrendPoint[]; domain: [number, number]; name: string; height: number; suffix?: string; color?: string }) {
  const id = `g-${name.replace(/\W/g, "")}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
        <YAxis domain={domain} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
        <Tooltip cursor={{ stroke: "rgba(255,255,255,0.25)", strokeDasharray: "3 3" }} content={<ChartTooltip format={(v) => `${v}${suffix ?? ""}`} />} />
        <Area type="monotone" dataKey="value" name={name} stroke={color} strokeWidth={2} fill={`url(#${id})`} connectNulls dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 5, stroke: "#141B2B", strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
