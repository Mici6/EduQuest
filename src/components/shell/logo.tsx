import { cn } from "@/lib/utils/format";

/** `gid` must be unique per rendered instance: a gradient defined inside a hidden (display:none) SVG does not paint elsewhere. */
export function LogoMark({ size = 32, className, gid = "eq-g" }: { size?: number; className?: string; gid?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF2B3" />
          <stop offset="0.55" stopColor="#FFD34D" />
          <stop offset="1" stopColor="#FF8A3D" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="10" fill={`url(#${gid})`} />
      <path d="M9 19.5 14 14l3.5 3.5L23 11" fill="none" stroke="#080B12" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 11H23v4.5" fill="none" stroke="#080B12" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="25.5" cy="25.5" r="2.5" fill="#7058D8" />
    </svg>
  );
}

export function Logo({ className, size = 30, gid }: { className?: string; size?: number; gid?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} gid={gid} />
      <span className="font-display text-[19px] font-bold tracking-tight">
        Edu<span className="text-sun-300">Quest</span>
      </span>
    </span>
  );
}
