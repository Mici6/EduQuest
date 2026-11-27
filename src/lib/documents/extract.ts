import "server-only";
import type { FileKind } from "./validate";

export type ExtractResult =
  | { ok: true; text: string; method: string }
  | { ok: false; status: "needs_ocr" | "failed"; reason: string };

/**
 * Text extraction per format. Images (and scanned PDFs without a text
 * layer) require OCR, which is only available when an OCR-capable AI
 * provider is configured; we report that honestly instead of guessing.
 */
export async function extractText(
  kind: FileKind,
  data: Uint8Array,
  mime: string,
  ocr?: (data: Uint8Array, mime: string) => Promise<string>,
): Promise<ExtractResult> {
  try {
    if (kind === "text") {
      return { ok: true, text: new TextDecoder("utf-8").decode(data), method: "utf-8" };
    }
    if (kind === "pdf") {
      const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(data));
      const { text } = await pdfText(pdf, { mergePages: false });
      const joined = (Array.isArray(text) ? text : [text]).join("\n\n").trim();
      if (joined.replace(/\s/g, "").length < 40) {
        return { ok: false, status: "needs_ocr", reason: "This PDF has no extractable text layer (it may be scanned). OCR is required." };
      }
      return { ok: true, text: joined, method: "pdf-text-layer" };
    }
    if (kind === "docx") {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(data) });
      return { ok: true, text: value, method: "docx" };
    }
    if (kind === "image") {
      if (!ocr) {
        return { ok: false, status: "needs_ocr", reason: "Image text recognition (OCR) isn't available. Upload a PDF, DOCX or text file instead." };
      }
      const text = await ocr(data, mime);
      if (!text.trim()) return { ok: false, status: "failed", reason: "No readable text was found in this image." };
      return { ok: true, text, method: "ocr" };
    }
    return { ok: false, status: "failed", reason: "Unsupported file type." };
  } catch (err) {
    console.error("[documents] extraction failed", err);
    return { ok: false, status: "failed", reason: "The file could not be read. It may be corrupted or password-protected." };
  }
}
