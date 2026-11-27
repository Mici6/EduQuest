"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cn } from "@/lib/utils/format";
import { SnowLeopard } from "@/components/companion/snow-leopard";

type ToastTone = "success" | "error" | "info" | "reward";
type ToastItem = { id: number; tone: ToastTone; title: string; body?: string };

const ToastContext = createContext<((t: Omit<ToastItem, "id">) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), t.tone === "error" ? 7000 : 4500);
    },
    [dismiss],
  );
  const value = useMemo(() => push, [push]);
  return (
    <ToastContext value={value}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:bottom-24 sm:right-6 lg:bottom-6 sm:top-auto sm:items-end">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-md transition-[opacity,translate] duration-[400ms] ease-[ease] starting:-translate-y-full starting:opacity-0 sm:starting:translate-y-full",
              t.tone === "error" && "border-rose/30 bg-ink-850/95",
              t.tone === "success" && "border-mint/30 bg-ink-850/95",
              t.tone === "info" && "border-line bg-ink-850/95",
              t.tone === "reward" && "border-sun-300/40 bg-ink-850/95 shadow-[0_0_40px_-12px_rgb(255_211_77/0.5)]",
            )}
          >
            <span className={cn("mt-0.5 [&_svg]:size-[18px]", t.tone === "error" ? "text-rose" : t.tone === "success" ? "text-mint" : t.tone === "reward" ? "text-sun-200" : "text-sky")}>
              {t.tone === "error" ? <CircleAlert /> : t.tone === "success" ? <CircleCheck /> : t.tone === "reward" ? <SnowLeopard mood="happy" className="!size-9 -my-1 -ml-1" title="Irbis cheers" /> : <Info />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.body ? <p className="mt-0.5 text-xs text-fg-2">{t.body}</p> : null}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="text-fg-3 hover:text-fg" aria-label="Dismiss notification">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
