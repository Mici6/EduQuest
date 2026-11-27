import { cn, initials } from "@/lib/utils/format";

export function Avatar({ name, hue = 40, size = 40, className, ring }: { name: string; hue?: number; size?: number; className?: string; ring?: boolean }) {
  return (
    <span
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-ink-950", ring && "ring-2 ring-ink-950 ring-offset-2 ring-offset-sun-300/60", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.36)),
        background: `linear-gradient(135deg, hsl(${hue} 85% 78%), hsl(${(hue + 35) % 360} 75% 62%))`,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 3, size = 28 }: { people: { name: string; hue: number }[]; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((p) => (
        <Avatar key={p.name} name={p.name} hue={p.hue} size={size} className="ring-2 ring-ink-800" />
      ))}
      {extra > 0 ? (
        <span className="inline-flex items-center justify-center rounded-full bg-ink-700 text-[10px] font-semibold text-fg-2 ring-2 ring-ink-800" style={{ width: size, height: size }}>
          +{extra}
        </span>
      ) : null}
    </div>
  );
}
