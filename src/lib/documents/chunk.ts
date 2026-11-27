/**
 * Split extracted text into overlapping, heading-aware chunks suitable for
 * retrieval and for prompt context.
 */
export type Chunk = { position: number; heading: string | null; content: string; tokenCount: number };

export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export const approxTokens = (s: string) => Math.ceil(s.length / 4);

function isHeading(line: string): boolean {
  const t = line.trim();
  if (/^#{1,6}\s+\S/.test(t)) return true;
  return t.length > 2 && t.length < 70 && !/[.!?,;:]$/.test(t) && /^[A-Z0-9]/.test(t) && t.split(/\s+/).length <= 9;
}

export function chunkText(text: string, target = 900, overlap = 150): Chunk[] {
  const paras = normalizeText(text).split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks: Chunk[] = [];
  let heading: string | null = null;
  let buf = "";
  let bufHeading: string | null = null;

  const flush = () => {
    const content = buf.trim();
    if (content) chunks.push({ position: chunks.length, heading: bufHeading, content, tokenCount: approxTokens(content) });
    buf = content.length > overlap ? content.slice(-overlap).replace(/^\S*\s/, "") : "";
    bufHeading = heading;
  };

  for (const p of paras) {
    const firstLine = p.split("\n")[0]!;
    if (isHeading(firstLine) && p.split("\n").length === 1) {
      if (buf.trim().length > overlap) flush();
      heading = firstLine.replace(/^#+\s*/, "");
      bufHeading = heading;
      buf = "";
      continue;
    }
    if (p.length > target) {
      const sentences = p.match(/[^.!?]+[.!?]+["')\]]?\s*|[^.!?]+$/g) ?? [p];
      for (const s of sentences) {
        if ((buf + " " + s).length > target && buf.trim()) flush();
        buf += (buf ? " " : "") + s.trim();
      }
    } else {
      if ((buf + "\n\n" + p).length > target && buf.trim()) flush();
      buf += (buf ? "\n\n" : "") + p;
    }
  }
  const tail = buf.trim();
  if (tail && (!chunks.length || !chunks.at(-1)!.content.endsWith(tail))) {
    chunks.push({ position: chunks.length, heading: bufHeading, content: tail, tokenCount: approxTokens(tail) });
  }
  return chunks;
}
