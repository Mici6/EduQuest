"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUp, ArrowUpRight, RotateCcw, Square, X } from "lucide-react";
import { Drawer } from "vaul";
import { RichText } from "@/components/study/rich-text";
import { useIsPhone } from "@/components/ui/dialog";
import { cn } from "@/lib/utils/format";
import { SnowLeopard, type LeopardMood } from "./snow-leopard";

type Msg = { role: "user" | "assistant"; content: string };
export type CompanionSummary = { firstName: string; streakDays: number; dueCount: number; overdueCount: number };

const STORE = "eq-irbis-chat";
const MAX_MESSAGE = 1000;
const STARTERS = ["Plan my evening", "I'm stressed about a test", "Motivate me", "What's due?"];

function greeting(s: CompanionSummary): string {
  const due = s.overdueCount
    ? `${s.overdueCount} thing${s.overdueCount > 1 ? "s are" : " is"} overdue, so we could start there.`
    : s.dueCount
      ? `You have ${s.dueCount} thing${s.dueCount > 1 ? "s" : ""} on your homework list.`
      : "Your homework list is clear.";
  const streak = s.streakDays > 1 ? ` And you're on a ${s.streakDays}-day streak. 🐾` : "";
  return `*paw wave* Hi ${s.firstName}, I'm Irbis, your snow leopard study companion. ${due}${streak} What shall we climb today?`;
}

function load(): Msg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as Msg[]) : [];
  } catch {
    return [];
  }
}

/** Floating snow-leopard companion for students: a bottom sheet on phones, a side panel on larger screens. */
export function CompanionDock({ summary }: { summary: CompanionSummary }) {
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  // Read once on the client; the chat only renders inside the drawer, after hydration.
  const [msgs, setMsgs] = useState<Msg[]>(load);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState<LeopardMood>("idle");
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const list = useRef<HTMLDivElement>(null);

  // The chat lives only in this browser tab (sessionStorage), never on the server.
  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-30)));
    } catch {
      /* private mode: keep it in memory only */
    }
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [msgs]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setError(null);
    setInput("");
    const history = msgs;
    setMsgs([...history, { role: "user", content: message }, { role: "assistant", content: "" }]);
    setBusy(true);
    setMood("thinking");
    const ctrl = new AbortController();
    abort.current = ctrl;
    let failed = false;
    try {
      const res = await fetch("/api/ai/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: history.slice(-10) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Irbis couldn't answer right now.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as { type: string; text?: string; message?: string };
          if (ev.type === "delta" && ev.text) setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: m.at(-1)!.content + ev.text }]);
          if (ev.type === "error") throw new Error(ev.message);
        }
      }
    } catch (err) {
      if (!ctrl.signal.aborted) {
        failed = true;
        setError(err instanceof Error ? err.message : "Irbis couldn't answer right now.");
        setMsgs((m) => (m.at(-1)?.role === "assistant" && !m.at(-1)!.content ? m.slice(0, -1) : m));
      }
    } finally {
      setBusy(false);
      abort.current = null;
      setMood(failed ? "idle" : "happy");
      if (!failed) setTimeout(() => setMood("idle"), 2200);
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const reset = () => {
    abort.current?.abort();
    setMsgs([]);
    setError(null);
  };

  const shown: Msg[] = [{ role: "assistant", content: greeting(summary) }, ...msgs];
  // Hand the last question over to the full tutor (lesson sources, citations, saved history).
  const lastQuestion = [...msgs].reverse().find((m) => m.role === "user")?.content.slice(0, 500) ?? null;

  return (
    <Drawer.Root open={open} onOpenChange={setOpen} direction={phone ? "bottom" : "right"}>
      <Drawer.Trigger
        aria-label="Open Irbis, your study companion"
        className="fixed bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.25rem)] right-4 z-30 inline-flex size-14 items-center justify-center rounded-full border border-white/10 bg-ink-800/95 shadow-[0_12px_30px_-10px_rgb(0_0_0/0.8)] backdrop-blur-xl transition-[scale,border-color] duration-[160ms] ease-out hover:border-iris-400/50 active:scale-[0.97] lg:bottom-6 lg:right-6"
      >
        <SnowLeopard className="size-12" />
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/55" />
        <Drawer.Content
          className={cn(
            "fixed z-50 flex flex-col border border-line bg-ink-850 text-fg outline-none",
            phone ? "inset-x-0 bottom-0 h-[85dvh] rounded-t-[28px] border-b-0" : "bottom-3 right-3 top-3 w-[400px] rounded-[28px]",
          )}
          style={phone ? undefined : ({ "--initial-transform": "calc(100% + 12px)" } as React.CSSProperties)}
        >
          {phone ? <Drawer.Handle className="mt-3 !h-1.5 !w-10 !bg-line-strong" /> : null}
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <SnowLeopard mood={mood} paw className="size-14" />
            <div className="min-w-0 flex-1">
              <Drawer.Title className="font-display text-lg font-semibold">Irbis</Drawer.Title>
              <Drawer.Description className="text-xs text-fg-3">{busy ? "Thinking…" : "Your snow leopard study companion"}</Drawer.Description>
            </div>
            {msgs.length ? (
              <button type="button" onClick={reset} className="inline-flex size-9 items-center justify-center rounded-full text-fg-3 transition-colors hover:bg-white/[0.06] hover:text-fg" aria-label="Start a new chat">
                <RotateCcw className="size-4" />
              </button>
            ) : null}
            <Drawer.Close className="inline-flex size-9 items-center justify-center rounded-full text-fg-3 transition-colors hover:bg-white/[0.06] hover:text-fg" aria-label="Close">
              <X className="size-[18px]" />
            </Drawer.Close>
          </div>

          <div ref={list} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {shown.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-[20px] px-3.5 py-2.5 text-sm leading-relaxed",
                    m.role === "user" ? "rounded-br-md bg-sun-200 text-ink-950" : "rounded-bl-md border border-line bg-ink-800 text-fg-2",
                  )}
                >
                  {m.role === "assistant" ? m.content ? <RichText text={m.content} /> : <span className="text-fg-3">Irbis is thinking…</span> : m.content}
                </div>
              </div>
            ))}
            {msgs.length === 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {STARTERS.map((s) => (
                  <button key={s} type="button" onClick={() => void send(s)} className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-fg-2 transition-colors hover:border-iris-400/50 hover:text-fg">
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
            {error ? <p className="rounded-2xl border border-rose/25 bg-rose/10 px-3 py-2 text-xs text-rose">{error}</p> : null}
          </div>

          <form onSubmit={submit} className="border-t border-line px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            {lastQuestion && !busy ? (
              <Link
                href={`/app/study/chat?q=${encodeURIComponent(lastQuestion)}`}
                onClick={() => setOpen(false)}
                className="mb-2 inline-flex items-center gap-1 rounded-full border border-iris-400/40 px-3 py-1.5 text-xs font-semibold text-iris-200 transition-colors hover:bg-iris-400/10"
              >
                Go deeper with Irbis in the AI tutor <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            ) : null}
            <div className="flex items-end gap-2">
              <label htmlFor="irbis-input" className="sr-only">
                Message Irbis
              </label>
              <textarea
                id="irbis-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                maxLength={MAX_MESSAGE}
                rows={1}
                placeholder="Talk to Irbis…"
                className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-ink-900/80 px-3.5 py-2.5 text-base text-fg placeholder:text-fg-3 focus:border-sun-300/60 focus:outline-none focus:ring-2 focus:ring-sun-300/20 sm:text-sm"
              />
              {busy ? (
                <button type="button" onClick={() => abort.current?.abort()} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-ink-700 text-fg" aria-label="Stop">
                  <Square className="size-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-sun-200 text-ink-950 transition-[scale,opacity] duration-[160ms] ease-out active:scale-[0.97] disabled:opacity-40"
                  aria-label="Send"
                >
                  <ArrowUp className="size-5" />
                </button>
              )}
            </div>
            <p className="mt-2 text-center text-[11px] text-fg-3">Irbis is an AI and can be wrong. If something is really wrong, talk to a trusted adult.</p>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
