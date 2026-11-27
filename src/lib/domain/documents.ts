import type { Actor } from "../auth/types";
import { can, studentClassIds, teacherClassIds, teacherTeaches } from "../auth/policy";
import { forbidden, invalid, notFound } from "../auth/errors";
import type { Db } from "../db/client";
import { newId } from "../db/client";
import { chunkText, normalizeText } from "../documents/chunk";
import type { ExtractResult } from "../documents/extract";
import { validateUpload, type FileKind } from "../documents/validate";
import { audit } from "./audit";
import { notify } from "./notifications";

export type DocumentRow = {
  id: string;
  title: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  visibility: "private" | "class" | "school";
  status: "uploaded" | "validating" | "extracting" | "chunking" | "indexed" | "needs_ocr" | "failed";
  status_detail: string | null;
  char_count: number;
  chunk_count: number;
  embeddings: string;
  created_at: string;
  owner_id: string;
  owner_name: string;
  owner_role: string;
  subject_name: string | null;
  subject_color: string | null;
  subject_id: string | null;
  class_name: string | null;
  class_id: string | null;
};

function accessClause(db: Db, actor: Actor): { sql: string; params: string[] } {
  if (actor.role === "student") {
    const ids = studentClassIds(db, actor.id);
    return {
      sql: `(d.owner_id = ? OR (d.visibility = 'class' AND d.class_id IN (${ids.map(() => "?").join(",") || "''"})) OR (d.visibility = 'school' AND d.school_id = ?))`,
      params: [actor.id, ...ids, actor.schoolId],
    };
  }
  if (actor.role === "teacher") {
    const ids = teacherClassIds(db, actor.id);
    return {
      sql: `(d.owner_id = ? OR (d.visibility <> 'private' AND d.class_id IN (${ids.map(() => "?").join(",") || "''"})) OR (d.visibility = 'school' AND d.school_id = ?))`,
      params: [actor.id, ...ids, actor.schoolId],
    };
  }
  if (actor.role === "admin") {
    return { sql: `(d.school_id = ? AND d.visibility <> 'private')`, params: [actor.schoolId] };
  }
  return { sql: "0", params: [] };
}

export function listDocuments(db: Db, actor: Actor): DocumentRow[] {
  const a = accessClause(db, actor);
  return db.all<DocumentRow>(
    `SELECT d.id, d.title, d.file_name, d.mime_type, d.size_bytes, d.visibility, d.status, d.status_detail, d.char_count, d.chunk_count, d.embeddings, d.created_at,
            d.owner_id, u.display_name owner_name, u.role owner_role, s.name subject_name, s.color subject_color, d.subject_id, c.name class_name, d.class_id
     FROM documents d JOIN users u ON u.id = d.owner_id LEFT JOIN subjects s ON s.id = d.subject_id LEFT JOIN classes c ON c.id = d.class_id
     WHERE ${a.sql} ORDER BY d.created_at DESC`,
    ...a.params,
  );
}

/** IDs of indexed documents the actor may use as AI grounding context. */
export function groundingDocumentIds(db: Db, actor: Actor, onlyDocumentId?: string | null): string[] {
  const ids = listDocuments(db, actor)
    .filter((d) => d.status === "indexed")
    .map((d) => d.id);
  if (onlyDocumentId) {
    if (!ids.includes(onlyDocumentId)) throw notFound("Document not found.");
    return [onlyDocumentId];
  }
  return ids;
}

export function getDocument(db: Db, actor: Actor, id: string): DocumentRow {
  const doc = listDocuments(db, actor).find((d) => d.id === id);
  if (!doc) throw notFound("Document not found.");
  return doc;
}

export function documentText(db: Db, actor: Actor, id: string): { doc: DocumentRow; text: string } {
  const doc = getDocument(db, actor, id);
  if (doc.status !== "indexed") throw invalid("This document has not finished processing.");
  const chunks = db.all<{ heading: string | null; content: string }>(`SELECT heading, content FROM document_chunks WHERE document_id = ? ORDER BY position`, id);
  return { doc, text: stitchChunks(chunks) };
}

/** Re-assemble overlapping chunks into the original text (overlaps removed). */
export function stitchChunks(chunks: { heading: string | null; content: string }[]): string {
  let text = "";
  let lastHeading: string | null = null;
  for (const c of chunks) {
    let content = c.content;
    if (text) {
      for (let n = Math.min(220, content.length, text.length); n >= 20; n--) {
        if (text.endsWith(content.slice(0, n))) {
          content = content.slice(n).replace(/^\s+/, " ");
          break;
        }
      }
    }
    if (c.heading && c.heading !== lastHeading) {
      text += `\n\n${c.heading}\n`;
      lastHeading = c.heading;
      text += content.trim();
    } else {
      text += content.startsWith(" ") ? content : (text ? "\n\n" : "") + content;
    }
  }
  return text.trim();
}

export type UploadInput = {
  fileName: string;
  data: Uint8Array;
  title?: string;
  subjectId?: string | null;
  classId?: string | null;
  visibility?: "private" | "class" | "school";
};

export type PipelineDeps = {
  maxBytes: number;
  store: (key: string, data: Uint8Array) => Promise<void>;
  extract: (kind: FileKind, data: Uint8Array, mime: string) => Promise<ExtractResult>;
};

export type PipelineEvent = { step: "validating" | "storing" | "extracting" | "chunking" | "indexing" | "done" | "error"; status?: string; message: string; documentId?: string };

/** Decide where an upload may be shared, according to role. */
function resolveScope(db: Db, actor: Actor, input: UploadInput): { classId: string | null; visibility: "private" | "class" | "school" } {
  if (actor.role === "student") {
    if (!can(actor, "documents.upload.private")) throw forbidden();
    return { classId: null, visibility: "private" };
  }
  if (actor.role === "teacher") {
    const visibility = input.visibility ?? (input.classId ? "class" : "private");
    if (visibility === "class") {
      if (!input.classId || !teacherTeaches(db, actor.id, input.classId)) throw forbidden("You can only share materials with classes you teach.");
      return { classId: input.classId, visibility };
    }
    if (visibility === "school") return { classId: input.classId ?? null, visibility };
    return { classId: null, visibility: "private" };
  }
  if (actor.role === "admin") return { classId: null, visibility: "school" };
  throw forbidden();
}

/**
 * Upload → validate → store → extract → chunk → index. Each step updates the
 * document's persisted status so the library shows real progress and real
 * failures. Embeddings are recorded as "lexical" (BM25) unless a vector
 * provider is configured.
 */
export async function* processUpload(db: Db, actor: Actor, input: UploadInput, deps: PipelineDeps): AsyncGenerator<PipelineEvent> {
  const scope = resolveScope(db, actor, input);
  yield { step: "validating", message: "Checking file type and size" };
  const v = validateUpload(input.fileName, input.data, deps.maxBytes);
  if (!v.ok) {
    yield { step: "error", message: v.reason };
    return;
  }
  const subjectId = input.subjectId && db.get(`SELECT 1 FROM subjects WHERE id = ? AND school_id = ?`, input.subjectId, actor.schoolId) ? input.subjectId : null;
  const id = newId("doc_");
  const title = (input.title?.trim() || v.safeName.replace(/\.[^.]+$/, "")).slice(0, 140);
  const storageKey = `${actor.schoolId}/${id}/${v.safeName}`;
  db.run(
    `INSERT INTO documents (id, school_id, owner_id, class_id, subject_id, title, file_name, mime_type, size_bytes, storage_key, visibility, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'validating')`,
    id,
    actor.schoolId,
    actor.id,
    scope.classId,
    subjectId,
    title,
    v.safeName,
    v.mime,
    input.data.byteLength,
    storageKey,
    scope.visibility,
  );
  audit(db, actor.id, "documents.upload", "document", id, { visibility: scope.visibility, bytes: input.data.byteLength });
  const setStatus = (status: DocumentRow["status"], detail: string | null = null) =>
    db.run(`UPDATE documents SET status = ?, status_detail = ? WHERE id = ?`, status, detail, id);

  try {
    yield { step: "storing", message: "Storing securely", documentId: id };
    await deps.store(storageKey, input.data);

    setStatus("extracting");
    yield { step: "extracting", message: v.kind === "image" ? "Recognising text in image" : "Extracting text", documentId: id };
    const extracted = await deps.extract(v.kind, input.data, v.mime);
    if (!extracted.ok) {
      setStatus(extracted.status, extracted.reason);
      yield { step: "error", status: extracted.status, message: extracted.reason, documentId: id };
      return;
    }
    const text = normalizeText(extracted.text);
    if (text.length < 40) {
      setStatus("failed", "Too little text was found to use this document.");
      yield { step: "error", status: "failed", message: "Too little text was found to use this document.", documentId: id };
      return;
    }

    setStatus("chunking");
    yield { step: "chunking", message: "Splitting into searchable sections", documentId: id };
    const chunks = chunkText(text);

    yield { step: "indexing", message: "Building search index", documentId: id };
    db.tx(() => {
      for (const c of chunks) {
        db.run(
          `INSERT INTO document_chunks (id, document_id, position, heading, content, token_count) VALUES (?, ?, ?, ?, ?, ?)`,
          newId("chk_"),
          id,
          c.position,
          c.heading,
          c.content,
          c.tokenCount,
        );
      }
      db.run(
        `UPDATE documents SET status = 'indexed', status_detail = ?, char_count = ?, chunk_count = ?, embeddings = 'lexical' WHERE id = ?`,
        `Extracted via ${extracted.method}`,
        text.length,
        chunks.length,
        id,
      );
      if (scope.visibility === "class" && scope.classId) {
        const students = db.all<{ user_id: string }>(
          `SELECT cm.user_id FROM class_memberships cm JOIN users u ON u.id = cm.user_id WHERE cm.class_id = ? AND u.role = 'student'`,
          scope.classId,
        );
        for (const s of students) {
          notify(db, s.user_id, { category: "study", title: `New lesson material: ${title}`, body: "Available in your library and AI study tools.", href: "/app/library", dedupeKey: `doc:${id}` });
        }
      }
    });
    yield { step: "done", status: "indexed", message: `Ready — ${chunks.length} sections indexed`, documentId: id };
  } catch (err) {
    console.error("[documents] pipeline error", err);
    setStatus("failed", "Processing failed unexpectedly.");
    yield { step: "error", status: "failed", message: "Processing failed unexpectedly.", documentId: id };
  }
}

export function deleteDocument(db: Db, actor: Actor, id: string) {
  const doc = db.get<{ owner_id: string; school_id: string }>(`SELECT owner_id, school_id FROM documents WHERE id = ?`, id);
  if (!doc) throw notFound();
  if (doc.owner_id !== actor.id && !(actor.role === "admin" && doc.school_id === actor.schoolId)) throw forbidden();
  db.run(`DELETE FROM documents WHERE id = ?`, id);
  audit(db, actor.id, "documents.delete", "document", id);
}
