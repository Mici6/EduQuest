import type { Db } from "../db/client";
import { terms } from "./text";

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  subjectName: string | null;
  heading: string | null;
  content: string;
  score: number;
};

/**
 * Lexical BM25 retrieval over document chunks the caller is already
 * authorised to read (`documentIds`). Used as the default grounding index;
 * a vector index can be added behind the same function when an embeddings
 * provider is configured.
 */
export function retrieve(db: Db, documentIds: string[], query: string, k = 4): RetrievedChunk[] {
  if (!documentIds.length) return [];
  const q = [...new Set(terms(query))];
  if (!q.length) return [];
  const rows = db.all<{ id: string; document_id: string; heading: string | null; content: string; title: string; subject_name: string | null }>(
    `SELECT c.id, c.document_id, c.heading, c.content, d.title, s.name subject_name
     FROM document_chunks c JOIN documents d ON d.id = c.document_id LEFT JOIN subjects s ON s.id = d.subject_id
     WHERE c.document_id IN (${documentIds.map(() => "?").join(",")}) AND d.status = 'indexed'`,
    ...documentIds,
  );
  if (!rows.length) return [];
  const docs = rows.map((r) => terms(`${r.title} ${r.heading ?? ""} ${r.content}`));
  const avgLen = docs.reduce((s, d) => s + d.length, 0) / docs.length;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const N = docs.length;
  const k1 = 1.4;
  const b = 0.75;
  const scored = rows.map((r, i) => {
    const d = docs[i]!;
    const tf = new Map<string, number>();
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    let matched = 0;
    for (const t of q) {
      const f = tf.get(t);
      if (!f) continue;
      matched++;
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / avgLen)));
    }
    // Reward chunks that cover more of the question's distinct terms.
    score *= 0.5 + matched / q.length / 2;
    return { chunkId: r.id, documentId: r.document_id, documentTitle: r.title, subjectName: r.subject_name, heading: r.heading, content: r.content, score: Math.round(score * 100) / 100 };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
}

/** Minimum BM25 score treated as "the lesson materials cover this". */
export const GROUNDING_THRESHOLD = 1.6;
