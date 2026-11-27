"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <span className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-rose/10 text-rose">
        <TriangleAlert className="size-7" aria-hidden />
      </span>
      <h1 className="font-display text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-fg-2">This page could not be loaded. Your data is safe — try again, or go back to your dashboard.</p>
      {error.digest ? <p className="mt-2 font-mono text-[11px] text-fg-3">Reference: {error.digest}</p> : null}
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>
          <RotateCcw /> Try again
        </Button>
        <a href="/app" className="inline-flex h-10 items-center rounded-full border border-line-strong px-4 text-sm font-semibold">
          Dashboard
        </a>
      </div>
    </div>
  );
}
