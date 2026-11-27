/** Small, dependency-free text utilities used by retrieval and the rule-based simulator. */

export const STOPWORDS = new Set(
  `a an and are as at be been being but by can could did do does doing for from had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with you your also may might must each both few many much any all every per via between about above after again against before below during further because own yet within without upon whose whether onto i.e e.g`.split(
    /\s+/,
  ),
);

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9²³]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Very light stemming so "forces" matches "force" and "reacting" matches "react". */
export function stem(t: string): string {
  if (t.length <= 4) return t;
  return t.replace(/(ations?|ings?|edly|ies|ied|es|ed|ly|s)$/, (m) => (m === "ies" || m === "ied" ? "y" : ""));
}

export const terms = (s: string) => tokenize(s).map(stem);

export function sentences(text: string): string[] {
  return (text.replace(/\n+/g, " ").match(/[^.!?]+[.!?]+["')\]]?|[^.!?]+$/g) ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.split(/\s+/).length >= 5);
}

/** Top keywords by frequency, preferring longer/capitalised terms (proper nouns, technical words). */
export function keywords(text: string, n = 12): string[] {
  const counts = new Map<string, { n: number; surface: string }>();
  const words = text.match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'-]{3,}/g) ?? [];
  for (const w of words) {
    const key = stem(w.toLowerCase());
    if (STOPWORDS.has(w.toLowerCase())) continue;
    const prev = counts.get(key);
    const bonus = /^[A-Z]/.test(w) ? 0.5 : 0;
    counts.set(key, { n: (prev?.n ?? 0) + 1 + bonus, surface: prev?.surface ?? w.toLowerCase() });
  }
  return [...counts.values()]
    .filter((v) => v.n >= 1.5)
    .sort((a, b) => b.n * Math.log(b.surface.length) - a.n * Math.log(a.surface.length))
    .slice(0, n)
    .map((v) => v.surface);
}

/** Classic frequency-based extractive summarisation; keeps original sentence order. */
export function extractiveSummary(text: string, maxSentences: number): string[] {
  const sents = sentences(text);
  if (sents.length <= maxSentences) return sents;
  const freq = new Map<string, number>();
  for (const t of terms(text)) freq.set(t, (freq.get(t) ?? 0) + 1);
  const scored = sents.map((s, i) => {
    const ts = terms(s);
    const score = ts.reduce((acc, t) => acc + (freq.get(t) ?? 0), 0) / Math.max(4, ts.length) + (i === 0 ? 0.5 : 0);
    return { s, i, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
}

const DEF_RE = /^(?:the |an? )?([A-Z]?[\w'’ -]{2,60}?)\s+(?:is|are|refers to|means|is called|is defined as|describes)\s+(.{12,})$/;

/** Sentences shaped like definitions: "X is Y". */
export function definitions(text: string): { term: string; definition: string; sentence: string }[] {
  const out: { term: string; definition: string; sentence: string }[] = [];
  for (const s of sentences(text)) {
    const m = s.match(DEF_RE);
    if (!m) continue;
    const term = m[1]!.trim();
    if (term.split(/\s+/).length > 6 || /^(it|this|that|there|these|they|he|she|which)$/i.test(term)) continue;
    out.push({ term: term.charAt(0).toUpperCase() + term.slice(1), definition: m[2]!.replace(/[.]$/, ""), sentence: s });
  }
  return out;
}

export function formulas(text: string): string[] {
  return [...new Set(text.split(/\n|(?<=\.)\s/).map((l) => l.trim()).filter((l) => /[A-Za-z0-9)\]]\s*(=|→|->)\s*[A-Za-z0-9(]/.test(l) && l.length < 140))];
}

export function datesMentioned(text: string): string[] {
  return [...new Set(sentences(text).filter((s) => /\b(1[0-9]{3}|20[0-9]{2})\b/.test(s)))].slice(0, 8);
}

/** Deterministic PRNG so simulated output is reproducible for the same input. */
export function seededRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}
