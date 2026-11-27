"use client";

import { Fragment, type ReactNode } from "react";
import { Globe } from "lucide-react";

/**
 * Minimal, safe renderer for AI/tutor text: paragraphs, bullet and numbered
 * lists, **bold**, `code`, [S1] citations and the "Beyond your lesson
 * materials:" marker. Never uses dangerouslySetInnerHTML.
 */
function inline(text: string, onCite?: (n: number) => void): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[S\d+\])/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-semibold text-fg">{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.9em]">{p.slice(1, -1)}</code>;
    const cite = p.match(/^\[S(\d+)\]$/);
    if (cite) {
      const n = Number(cite[1]);
      return (
        <button
          key={i}
          type="button"
          onClick={() => onCite?.(n)}
          className="mx-0.5 inline-flex h-[18px] -translate-y-px items-center rounded-md bg-mint/20 px-1.5 align-middle text-[10px] font-bold text-mint hover:bg-mint/30"
          aria-label={`Source ${n}`}
        >
          S{n}
        </button>
      );
    }
    return <Fragment key={i}>{p}</Fragment>;
  });
}

export function RichText({ text, onCite }: { text: string; onCite?: (n: number) => void }) {
  const blocks: ReactNode[] = [];
  // Models sometimes add Markdown this renderer doesn't support: drop rules, quote markers and LaTeX delimiters.
  const lines = text
    .replace(/\r/g, "")
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\\\(|\\\)|\\\[|\\\]/g, "")
    .split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={`l${blocks.length}`} className={list.ordered ? "ml-5 list-decimal space-y-1" : "ml-5 list-disc space-y-1 marker:text-fg-3"}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it, onCite)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const num = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || num) {
      const ordered = !!num;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? num)![1]!);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    if (/^beyond your lesson materials:?/i.test(line.trim())) {
      blocks.push(
        <p key={`b${blocks.length}`} className="mt-1 flex items-center gap-2 border-t border-dashed border-iris-400/40 pt-3 text-xs font-semibold text-iris-200">
          <Globe className="size-3.5" aria-hidden /> Beyond your lesson materials (general knowledge)
        </p>,
      );
      const rest = line.trim().replace(/^beyond your lesson materials:?\s*/i, "");
      if (rest) blocks.push(<p key={`p${blocks.length}`}>{inline(rest, onCite)}</p>);
      continue;
    }
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (heading) {
      blocks.push(
        <p key={`h${blocks.length}`} className="font-display font-semibold text-fg">
          {inline(heading[1]!, onCite)}
        </p>,
      );
      continue;
    }
    blocks.push(<p key={`p${blocks.length}`}>{inline(line, onCite)}</p>);
  }
  flush();
  return <div className="space-y-2.5 text-sm leading-relaxed text-fg-2">{blocks}</div>;
}
