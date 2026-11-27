"use client";

import { useId } from "react";
import { cn } from "@/lib/utils/format";

export type LeopardMood = "idle" | "happy" | "thinking";

const INK = "#2a3140";
const SPOT = "#3b4352";
const PAD = "#c9a2a9";

/**
 * Irbis, an original snow-leopard cub drawing (inspired by snow-leopard photo
 * moodboards, not traced from any image): pale spotted fur, small dark-rimmed
 * ears, big round eyes and, optionally, a raised paw showing its pads.
 * Blinks every few seconds unless the user prefers reduced motion.
 */
export function SnowLeopard({ mood = "idle", paw = false, className, title }: { mood?: LeopardMood; paw?: boolean; className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  const fur = `fur-${id}`;
  const shade = `shade-${id}`;
  return (
    <svg viewBox="0 0 128 128" className={cn("shrink-0", className)} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <radialGradient id={fur} cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#f6f8fb" />
          <stop offset="70%" stopColor="#e3e8ef" />
          <stop offset="100%" stopColor="#c9d1dc" />
        </radialGradient>
        <radialGradient id={shade} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#eef2f6" />
        </radialGradient>
      </defs>

      {/* Ears: dark backs, pale inside */}
      {[30, 98].map((x) => (
        <g key={x}>
          <circle cx={x} cy={31} r={14} fill={INK} />
          <circle cx={x} cy={32} r={10} fill="#d3dae3" />
          <circle cx={x} cy={33} r={5.5} fill="#b9c2ce" />
        </g>
      ))}

      {/* Head and fluffy cheeks */}
      <ellipse cx={64} cy={63} rx={46} ry={40} fill={`url(#${fur})`} />
      <ellipse cx={27} cy={80} rx={17} ry={13} fill="#e6ebf1" />
      <ellipse cx={101} cy={80} rx={17} ry={13} fill="#e6ebf1" />
      <path d="M14 80 l-4 3 5 1 M18 88 l-4 4 6 0 M114 80 l4 3 -5 1 M110 88 l4 4 -6 0" stroke="#c9d1dc" strokeWidth={2} strokeLinecap="round" fill="none" />

      {/* Forehead spots and side rosettes */}
      {[
        [64, 29, 2.6],
        [56, 33, 2.2],
        [72, 33, 2.2],
        [60, 41, 1.9],
        [68, 41, 1.9],
        [64, 47, 1.6],
      ].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={SPOT} />
      ))}
      {[
        [27, 55, 5.5],
        [101, 55, 5.5],
        [21, 70, 3.8],
        [107, 70, 3.8],
        [40, 40, 3],
        [88, 40, 3],
      ].map(([x, y, r]) => (
        <circle key={`r-${x}-${y}`} cx={x} cy={y} r={r} fill="none" stroke={SPOT} strokeWidth={2.4} strokeDasharray={`${r * 1.6} ${r * 0.9}`} strokeLinecap="round" />
      ))}

      {/* Eyes */}
      {mood === "happy" ? (
        <g stroke={INK} strokeWidth={3.6} strokeLinecap="round" fill="none">
          <path d="M37 65 Q46 54 55 65" />
          <path d="M73 65 Q82 54 91 65" />
        </g>
      ) : (
        <g className="origin-center animate-[eq-blink_6s_ease-in-out_infinite] [transform-box:fill-box] motion-reduce:animate-none">
          {[46, 82].map((x) => (
            <g key={x}>
              <circle cx={x} cy={63} r={12} fill="#c8d4c3" stroke={INK} strokeWidth={2.2} />
              <circle cx={mood === "thinking" ? x - 2 : x} cy={mood === "thinking" ? 59 : 63} r={mood === "thinking" ? 7 : 8.6} fill="#121822" />
              <circle cx={(mood === "thinking" ? x - 2 : x) + 3.4} cy={(mood === "thinking" ? 59 : 63) - 3.4} r={3.2} fill="#fff" />
              <circle cx={(mood === "thinking" ? x - 2 : x) - 3} cy={(mood === "thinking" ? 59 : 63) + 3} r={1.4} fill="#fff" />
            </g>
          ))}
        </g>
      )}
      {/* Tear-line markings */}
      <path d="M53 70 Q55 75 56 78 M75 70 Q73 75 72 78" stroke={SPOT} strokeWidth={1.8} strokeLinecap="round" fill="none" />

      {/* Muzzle, nose, mouth */}
      <ellipse cx={56} cy={84} rx={11.5} ry={8.5} fill={`url(#${shade})`} />
      <ellipse cx={72} cy={84} rx={11.5} ry={8.5} fill={`url(#${shade})`} />
      <ellipse cx={64} cy={93} rx={7} ry={4} fill="#f4f6f9" />
      <path d="M57.5 74.5 Q64 71.5 70.5 74.5 Q66.5 80.5 64 81.5 Q61.5 80.5 57.5 74.5 Z" fill="#c4949b" />
      <path d="M64 81.5 V85 M64 85 Q60 89.5 55.5 86.5 M64 85 Q68 89.5 72.5 86.5" stroke={INK} strokeWidth={1.8} strokeLinecap="round" fill="none" />
      {mood === "happy" ? <path d="M60 88 Q64 93 68 88" fill="#d58d97" /> : null}
      {[
        [51, 83],
        [48, 87],
        [77, 83],
        [80, 87],
      ].map(([x, y]) => (
        <circle key={`w-${x}-${y}`} cx={x} cy={y} r={0.9} fill={SPOT} />
      ))}

      {/* Raised paw with pads */}
      {paw ? (
        <g>
          <path d="M84 128 L84 110 Q84 90 99 89 Q114 90 114 110 L114 128 Z" fill={`url(#${fur})`} stroke="#c9d1dc" strokeWidth={1.2} />
          <ellipse cx={99} cy={108} rx={8.2} ry={6.4} fill={PAD} />
          {[
            [88.5, 99, 3.3],
            [94.5, 94, 3.5],
            [103.5, 94, 3.5],
            [109.5, 99, 3.3],
          ].map(([x, y, r]) => (
            <ellipse key={`p-${x}`} cx={x} cy={y} rx={r} ry={r * 1.15} fill={PAD} />
          ))}
          <circle cx={90} cy={118} r={1.6} fill={SPOT} />
          <circle cx={108} cy={120} r={1.8} fill={SPOT} />
        </g>
      ) : null}
    </svg>
  );
}
