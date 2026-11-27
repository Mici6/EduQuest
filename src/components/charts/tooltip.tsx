"use client";

type Payload = { name?: string | number; value?: number | string | null; color?: string; dataKey?: string | number };

export function ChartTooltip({
  active,
  payload,
  label,
  format,
  labelFormat,
}: {
  active?: boolean;
  payload?: Payload[];
  label?: string | number;
  format?: (v: number) => string;
  labelFormat?: (l: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-ink-950/95 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-fg">{labelFormat ? labelFormat(String(label)) : label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-fg-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span>{p.name}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums text-fg">{p.value == null ? "—" : format ? format(Number(p.value)) : p.value}</span>
        </p>
      ))}
    </div>
  );
}
