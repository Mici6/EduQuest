"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, BookOpen, Bot, CircleStop, FlaskConical, Globe, MessageSquarePlus, MessagesSquare, Trash2 } from "lucide-react";
import { deleteConversationAction, saveTutorReplyAction } from "@/actions/ai";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { PillTabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { browserAiReady, browserProvider } from "@/lib/ai/browser";
import { cn, relativeTime } from "@/lib/utils/format";
import { SnowLeopard, type LeopardMood } from "@/components/companion/snow-leopard";
import { RichText } from "./rich-text";

type Source = { id: string; documentId: string; title: string; heading: string | null; excerpt: string; score: number };
type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  grounding: string | null;
  provider: string | null;
  simulated: boolean;
  streaming?: boolean;
  error?: boolean;
};
type Conversation = { id: string; title: string; updated_at: string };
type Level = "simpler" | "standard" | "advanced";

const SUGGESTIONS = [
  "Explain photosynthesis in simple terms",
  "What are Newton's three laws of motion?",
  "How do I solve 5x − 3 = 2x + 9?",
  "Why did the French Revolution start?",
  "What is the difference between ionic and covalent bonds?",
];

export function TutorChat({
  initialConversationId,
  initialMessages,
  conversations: initialConversations,
  docs,
  initialDocId,
  initialPrompt,
  aiAvailable,
  studentName,
}: {
  studentName: string;
  initialConversationId: string | null;
  initialMessages: Msg[];
  conversations: Conversation[];
  docs: { id: string; title: string }[];
  initialDocId: string | null;
  initialPrompt: string | null;
  aiAvailable: boolean;
}) {
  const toast = useToast();
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [conversations, setConversations] = useState(initialConversations);
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [level, setLevel] = useState<Level>("standard");
  const [docId, setDocId] = useState(initialDocId ?? "");
  const [busy, setBusy] = useState(false);
  const [cheer, setCheer] = useState(false);
  const mood: LeopardMood = busy ? "thinking" : cheer ? "happy" : "idle";
  const [highlight, setHighlight] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const autoSent = useRef(false);
  const [, startDelete] = useTransition();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send(text: string, lv: Level = level) {
    const question = text.trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);
    const userMsg: Msg = { id: `u${Date.now()}`, role: "user", content: question, sources: [], grounding: null, provider: null, simulated: false };
    const asstId = `a${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: asstId, role: "assistant", content: "", sources: [], grounding: null, provider: null, simulated: false, streaming: true }]);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const patch = (fn: (m: Msg) => Msg) => setMessages((ms) => ms.map((m) => (m.id === asstId ? fn(m) : m)));
    const applyMeta = (ev: { conversationId: string; sources: Source[]; grounding: string; provider: { label: string; simulated: boolean } }) => {
      if (!conversationId) {
        setConversationId(ev.conversationId);
        setConversations((cs) => [{ id: ev.conversationId, title: question.slice(0, 60), updated_at: new Date().toISOString() }, ...cs]);
        window.history.replaceState(null, "", `/app/study/chat?c=${ev.conversationId}`);
      }
      patch((m) => ({ ...m, sources: ev.sources, grounding: ev.grounding, provider: ev.provider.label, simulated: ev.provider.simulated }));
    };
    try {
      if (browserAiReady()) {
        // On-device model: the server prepares the turn (access, quota, lesson excerpts), the browser answers.
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, message: question, documentId: docId || null, level: lv, local: true }),
          signal: ctrl.signal,
        });
        const turn = await res.json().catch(() => ({ error: "The tutor is unavailable right now." }));
        if (!res.ok) {
          patch((m) => ({ ...m, streaming: false, error: true, content: turn.error ?? "The tutor is unavailable right now." }));
          return;
        }
        applyMeta({ ...turn, provider: { label: browserProvider.label, simulated: false } });
        let text = "";
        try {
          for await (const d of browserProvider.tutor({ question, history: turn.history, sources: turn.chunks, grounded: turn.grounded, level: lv, studentName: turn.studentName }, ctrl.signal)) {
            text += d;
            patch((m) => ({ ...m, content: m.content + d }));
          }
        } catch (err) {
          console.error("[tutor] on-device model failed", err);
          patch((m) => ({ ...m, error: true, content: m.content || "The on-device AI couldn't answer. Please try again." }));
        }
        const stopped = ctrl.signal.aborted;
        if (text) void saveTutorReplyAction(turn.conversationId, stopped ? text + "\n\n_(stopped)_" : text, turn.sources, turn.grounding);
        patch((m) => ({ ...m, streaming: false, content: stopped ? m.content + (m.content ? "\n\n_(stopped)_" : "Stopped.") : m.content }));
        return;
      }
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: question, documentId: docId || null, level: lv }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "The tutor is unavailable right now." }));
        patch((m) => ({ ...m, streaming: false, error: true, content: err.error ?? "The tutor is unavailable right now." }));
        return;
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
          const ev = JSON.parse(line);
          if (ev.type === "meta") applyMeta(ev);
          else if (ev.type === "delta") {
            patch((m) => ({ ...m, content: m.content + ev.text }));
          } else if (ev.type === "error") {
            patch((m) => ({ ...m, error: true, content: m.content || ev.message }));
          }
        }
      }
      patch((m) => ({ ...m, streaming: false }));
    } catch (err) {
      if ((err as Error).name === "AbortError") patch((m) => ({ ...m, streaming: false, content: m.content + (m.content ? "\n\n_(stopped)_" : "Stopped.") }));
      else patch((m) => ({ ...m, streaming: false, error: true, content: "Connection lost. Please try again." }));
    } finally {
      setBusy(false);
      abortRef.current = null;
      // Irbis looks pleased for a moment after answering.
      setCheer(true);
      setTimeout(() => setCheer(false), 2200);
    }
  }

  useEffect(() => {
    if (initialPrompt && !autoSent.current && !initialMessages.length && aiAvailable) {
      autoSent.current = true;
      void send(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const newChat = () => {
    if (busy) return;
    setConversationId(null);
    setMessages([]);
    window.history.replaceState(null, "", "/app/study/chat");
  };

  const remove = (id: string) =>
    startDelete(async () => {
      const res = await deleteConversationAction(id);
      if (!res.ok) return toast({ tone: "error", title: "Couldn't delete", body: res.error });
      setConversations((cs) => cs.filter((c) => c.id !== id));
      if (id === conversationId) newChat();
    });

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && !m.streaming && !m.error);

  return (
    <div className="grid gap-5 @4xl:grid-cols-[260px_1fr]">
      <aside className="hidden @4xl:block" aria-label="Conversations">
        <Button variant="secondary" className="mb-3 w-full" onClick={newChat}>
          <MessageSquarePlus /> New conversation
        </Button>
        <ul className="space-y-1">
          {conversations.map((c) => (
            <li key={c.id} className="group relative">
              <Link
                href={`/app/study/chat?c=${c.id}`}
                className={cn("block rounded-2xl px-3 py-2.5 pr-9 text-sm transition-colors", c.id === conversationId ? "bg-white/[0.07] text-fg" : "text-fg-2 hover:bg-white/[0.04]")}
              >
                <span className="line-clamp-1 font-medium">{c.title}</span>
                <span className="text-[11px] text-fg-3">{relativeTime(c.updated_at)}</span>
              </Link>
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-fg-3 opacity-0 hover:bg-rose/10 hover:text-rose focus:opacity-100 group-hover:opacity-100"
                aria-label={`Delete conversation ${c.title}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
          {!conversations.length ? <li className="px-3 text-xs text-fg-3">No conversations yet.</li> : null}
        </ul>
      </aside>

      <section className="surface flex h-[calc(100dvh-330px)] min-h-[440px] flex-col overflow-hidden rounded-[var(--radius-card)] lg:h-[calc(100dvh-210px)]" aria-label="Tutor chat">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
          <SnowLeopard mood={mood} className="size-10" />
          <div className="mr-auto min-w-0">
            <p className="font-display text-sm font-semibold leading-tight">Irbis · AI tutor</p>
            <p className="text-[11px] text-fg-3">{busy ? "Thinking…" : "Uses your lesson materials first"}</p>
          </div>
          <label className="sr-only" htmlFor="doc-scope">
            Materials to use
          </label>
          <Select id="doc-scope" value={docId} onChange={(e) => setDocId(e.target.value)} className="!h-9 max-w-56 !rounded-full text-xs">
            <option value="">All my materials</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </Select>
          <Button variant="ghost" size="icon-sm" onClick={newChat} className="@4xl:hidden" aria-label="New conversation">
            <MessageSquarePlus />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite" aria-busy={busy}>
          {messages.length === 0 ? (
            <div className="mx-auto flex max-w-lg flex-col items-center py-6 text-center">
              <SnowLeopard mood="idle" paw className="mb-3 size-28" />
              <h2 className="font-display text-xl font-semibold">Hi {studentName}! What shall we figure out together?</h2>
              <p className="mt-2 text-sm text-fg-2">
                I&apos;m Irbis. I check your teachers&apos; lesson materials first, show you exactly where an answer comes from, and tell you clearly when something isn&apos;t covered. One ledge at a time. 🐾
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} disabled={!aiAvailable} className="rounded-full border border-line bg-ink-900/70 px-3 py-1.5 text-xs font-medium text-fg-2 hover:border-iris-400/50 hover:text-fg disabled:opacity-50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ol className="mx-auto max-w-3xl space-y-5">
              {messages.map((m) =>
                m.role === "user" ? (
                  <li key={m.id} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-sun-200 px-4 py-2.5 text-sm text-ink-950">{m.content}</p>
                  </li>
                ) : (
                  <li key={m.id} className="flex gap-3">
                    <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-ink-800" title="Irbis">
                      <SnowLeopard mood={m.streaming ? "thinking" : "idle"} className="size-8" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        {m.simulated ? (
                          <Badge tone="ember" icon={<FlaskConical />}>
                            Simulated
                          </Badge>
                        ) : m.provider ? (
                          <Badge tone="iris" icon={<Bot />}>
                            {m.provider}
                          </Badge>
                        ) : null}
                        {m.grounding === "lesson" ? (
                          <Badge tone="mint" icon={<BookOpen />}>
                            From your lessons
                          </Badge>
                        ) : m.grounding === "general" ? (
                          <Badge tone="sky" icon={<Globe />}>
                            Not found in your materials
                          </Badge>
                        ) : null}
                      </div>
                      <div className={cn("rounded-3xl rounded-tl-lg border px-4 py-3", m.error ? "border-rose/30 bg-rose/[0.06]" : "border-line bg-ink-900/70")}>
                        {m.content ? (
                          <RichText text={m.content} onCite={(n) => setHighlight(m.sources[n - 1]?.id ?? null)} />
                        ) : (
                          <span className="inline-flex items-center gap-2 py-1 text-xs text-fg-3" aria-label="Irbis is thinking">
                            Irbis is thinking
                            <span className="inline-flex gap-1">
                              {[0, 1, 2].map((i) => (
                                <span key={i} className="size-1.5 animate-pulse rounded-full bg-fg-3" style={{ animationDelay: `${i * 150}ms` }} />
                              ))}
                            </span>
                          </span>
                        )}
                      </div>
                      {m.sources.length ? (
                        <details className="mt-2 group/src">
                          <summary className="cursor-pointer list-none text-xs font-semibold text-fg-3 hover:text-fg-2">
                            {m.sources.length} source{m.sources.length === 1 ? "" : "s"} from your materials <span className="group-open/src:hidden">▸</span>
                            <span className="hidden group-open/src:inline">▾</span>
                          </summary>
                          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                            {m.sources.map((s, i) => (
                              <li key={s.id} className={cn("rounded-2xl border bg-ink-900/60 p-3 text-xs transition-colors", highlight === s.id ? "border-mint/60" : "border-line")}>
                                <p className="mb-1 flex items-center gap-1.5 font-semibold text-fg">
                                  <span className="rounded bg-mint/20 px-1 text-[10px] text-mint">S{i + 1}</span>
                                  <Link href={`/app/library/${s.documentId}`} className="truncate hover:underline">
                                    {s.title}
                                  </Link>
                                </p>
                                {s.heading ? <p className="mb-1 text-[11px] text-fg-3">{s.heading}</p> : null}
                                <p className="line-clamp-4 text-fg-2">{s.excerpt}</p>
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </div>
                  </li>
                ),
              )}
            </ol>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-line bg-ink-900/40 px-3 pb-3 pt-3 sm:px-5">
          {lastAssistant && !busy ? (
            <div className="scrollbar-none mb-2.5 flex gap-2 overflow-x-auto">
              {[
                { label: "Explain more simply", text: "Can you explain that more simply, with an everyday example?", lv: "simpler" as Level },
                { label: "Give me an example", text: "Can you give me a worked example?", lv: level },
                { label: "Quiz me on this", text: "Ask me 3 short practice questions about this, one at a time, and wait for my answer.", lv: level },
                { label: "Go deeper", text: "Can you explain this in more depth?", lv: "advanced" as Level },
              ].map((a) => (
                <button key={a.label} type="button" onClick={() => send(a.text, a.lv)} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-fg-2 hover:border-iris-400/50 hover:text-fg">
                  {a.label}
                </button>
              ))}
            </div>
          ) : null}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-end gap-2 rounded-[24px] border border-line bg-ink-950/60 p-2 focus-within:border-iris-400/60"
          >
            <label htmlFor="tutor-input" className="sr-only">
              Ask a question
            </label>
            <textarea
              id="tutor-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              maxLength={4000}
              disabled={!aiAvailable}
              placeholder={aiAvailable ? "Ask Irbis about a lesson, a concept or a homework question…" : "AI is not configured for this school."}
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-sm placeholder:text-fg-3 focus:outline-none"
            />
            {busy ? (
              <Button type="button" variant="secondary" size="icon" onClick={() => abortRef.current?.abort()} aria-label="Stop generating">
                <CircleStop />
              </Button>
            ) : (
              <Button type="submit" variant="iris" size="icon" disabled={!input.trim() || !aiAvailable} aria-label="Send">
                <ArrowUp />
              </Button>
            )}
          </form>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <PillTabs
              label="Explanation level"
              size="sm"
              value={level}
              onChange={setLevel}
              items={[
                { value: "simpler", label: "Simpler" },
                { value: "standard", label: "Standard" },
                { value: "advanced", label: "Advanced" },
              ]}
            />
            <p className="inline-flex items-center gap-1 text-[11px] text-fg-3">
              <MessagesSquare className="size-3" aria-hidden /> Irbis guides you step by step: he won&apos;t just hand over homework answers.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
