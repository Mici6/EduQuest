"use client";

import { useState, useTransition } from "react";
import { Check, Lock } from "lucide-react";
import { saveSettingsAction } from "@/actions/account";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/format";
import { FRAME_RING } from "@/components/shell/app-shell";

export function FramePicker({ frames, current, level, name, hue }: { frames: { id: string; label: string; level: number }[]; current: string; level: number; name: string; hue: number }) {
  const toast = useToast();
  const [value, setValue] = useState(current);
  const [pending, start] = useTransition();
  const choose = (id: string) =>
    start(async () => {
      const prev = value;
      setValue(id);
      const res = await saveSettingsAction({ profileFrame: id });
      if (!res.ok) {
        setValue(prev);
        toast({ tone: "error", title: "Couldn't equip", body: res.error });
      }
    });
  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5" aria-busy={pending}>
      {frames.map((f) => {
        const unlocked = level >= f.level;
        const active = value === f.id;
        return (
          <li key={f.id}>
            <button
              type="button"
              disabled={!unlocked || pending}
              onClick={() => choose(f.id)}
              aria-pressed={active}
              className={cn("flex w-full flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors", active ? "border-sun-300/60 bg-sun-300/[0.08]" : "border-line bg-ink-900/60", !unlocked && "opacity-50")}
            >
              <Avatar name={name} hue={hue} size={40} className={cn(FRAME_RING[f.id], !unlocked && "grayscale")} />
              <span className="text-[11px] font-semibold leading-tight">{f.label}</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-fg-3">
                {active ? <Check className="size-3 text-mint" /> : unlocked ? "Equip" : <Lock className="size-3" />}
                {!unlocked ? `Level ${f.level}` : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
