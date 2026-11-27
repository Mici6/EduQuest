import { beforeEach, describe, expect, it } from "vitest";
import { actor, seededDb } from "./support/db";
import type { Db } from "../src/lib/db/client";
import { chunkText } from "../src/lib/documents/chunk";
import { validateUpload } from "../src/lib/documents/validate";
import { processUpload, stitchChunks, type PipelineDeps } from "../src/lib/domain/documents";
import { retrieve } from "../src/lib/ai/retrieval";

let db: Db;
beforeEach(() => {
  db = seededDb();
});

const enc = (s: string) => new TextEncoder().encode(s);
const deps = (overrides: Partial<PipelineDeps> = {}): PipelineDeps => ({
  maxBytes: 1024 * 1024,
  store: async () => {},
  extract: async (kind, d) => (kind === "image" ? { ok: false, status: "needs_ocr", reason: "OCR unavailable" } : { ok: true, text: new TextDecoder().decode(d), method: "utf-8" }),
  ...overrides,
});

async function run(gen: AsyncGenerator<{ step: string; status?: string; documentId?: string; message: string }>) {
  const out = [];
  for await (const e of gen) out.push(e);
  return out;
}

describe("upload validation", () => {
  it("checks content, not just the extension", () => {
    expect(validateUpload("notes.txt", enc("Plain text notes"), 1000).ok).toBe(true);
    expect(validateUpload("fake.pdf", enc("not really a pdf"), 1000)).toMatchObject({ ok: false });
    expect(validateUpload("virus.exe", enc("MZ"), 1000)).toMatchObject({ ok: false });
    expect(validateUpload("big.txt", enc("x".repeat(2000)), 1000)).toMatchObject({ ok: false });
    expect(validateUpload("scan.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), 1000)).toMatchObject({ ok: true, kind: "image" });
    expect(validateUpload("../../etc/passwd.txt", enc("hello world"), 1000)).toMatchObject({ ok: true, safeName: "passwd.txt" });
  });
});

describe("chunking", () => {
  it("splits long text into overlapping chunks that stitch back together", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} explains an important idea about forces and motion in detail.`).join(" ");
    const chunks = chunkText(text, 500, 120);
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((c) => c.content.length <= 640)).toBe(true);
    const stitched = stitchChunks(chunks.map((c) => ({ heading: c.heading, content: c.content })));
    expect(stitched.replace(/\s+/g, " ")).toContain("Sentence number 39");
    expect(stitched.split("Sentence number 20 ").length).toBe(2);
  });
});

describe("processing pipeline", () => {
  it("indexes a text upload end-to-end with real status steps", async () => {
    const novak = actor(db, "usr_novak");
    const events = await run(
      processUpload(db, novak, { fileName: "algebra.md", title: "Algebra recap", classId: "cls_10a", visibility: "class", data: enc("# Algebra\n\n" + "Solving equations keeps both sides balanced. ".repeat(40)) }, deps()),
    );
    expect(events.map((e) => e.step)).toEqual(["validating", "storing", "extracting", "chunking", "indexing", "done"]);
    const id = events.at(-1)!.documentId!;
    const doc = db.get<{ status: string; chunk_count: number; visibility: string }>(`SELECT status, chunk_count, visibility FROM documents WHERE id = ?`, id)!;
    expect(doc).toMatchObject({ status: "indexed", visibility: "class" });
    expect(doc.chunk_count).toBeGreaterThan(0);
  });

  it("reports images as needing OCR instead of pretending to process them", async () => {
    const events = await run(processUpload(db, actor(db, "usr_alex"), { fileName: "worksheet.png", data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]) }, deps()));
    expect(events.at(-1)).toMatchObject({ step: "error", status: "needs_ocr" });
    expect(db.get<{ status: string }>(`SELECT status FROM documents WHERE id = ?`, events.at(-1)!.documentId!)!.status).toBe("needs_ocr");
  });

  it("forces student uploads to be private and rejects teacher sharing to classes they don't teach", async () => {
    const alexEvents = await run(processUpload(db, actor(db, "usr_alex"), { fileName: "n.txt", classId: "cls_10a", visibility: "school", data: enc("Notes ".repeat(30)) }, deps()));
    expect(db.get<{ visibility: string }>(`SELECT visibility FROM documents WHERE id = ?`, alexEvents.at(-1)!.documentId!)!.visibility).toBe("private");
    db.run(`INSERT INTO users (id, school_id, role, display_name, email) VALUES ('usr_newt', 'sch_demo', 'teacher', 'New Teacher', 'nt@demo.eduquest.example')`);
    await expect(run(processUpload(db, actor(db, "usr_newt"), { fileName: "n.txt", classId: "cls_10a", visibility: "class", data: enc("x ".repeat(50)) }, deps()))).rejects.toThrow();
  });
});

describe("retrieval", () => {
  it("finds the relevant lesson passage with BM25", () => {
    const hits = retrieve(db, ["doc_photosynthesis", "doc_newton", "doc_french"], "why does chlorophyll make leaves look green", 3);
    expect(hits[0]!.documentId).toBe("doc_photosynthesis");
    expect(hits[0]!.content.toLowerCase()).toContain("chlorophyll");
  });

  it("returns nothing for unrelated questions", () => {
    expect(retrieve(db, ["doc_photosynthesis"], "basketball tournament results", 3)).toEqual([]);
  });
});
