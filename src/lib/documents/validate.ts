/**
 * Upload validation. The declared MIME type and extension are never trusted
 * on their own: the file's leading bytes must match the claimed format.
 */
export type FileKind = "pdf" | "docx" | "text" | "image";

export const ACCEPTED: Record<string, { kind: FileKind; mime: string }> = {
  pdf: { kind: "pdf", mime: "application/pdf" },
  docx: { kind: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  txt: { kind: "text", mime: "text/plain" },
  md: { kind: "text", mime: "text/markdown" },
  png: { kind: "image", mime: "image/png" },
  jpg: { kind: "image", mime: "image/jpeg" },
  jpeg: { kind: "image", mime: "image/jpeg" },
  webp: { kind: "image", mime: "image/webp" },
};

export const ACCEPT_ATTR = Object.keys(ACCEPTED).map((e) => "." + e).join(",");

export type ValidationResult =
  | { ok: true; kind: FileKind; mime: string; ext: string; safeName: string }
  | { ok: false; reason: string };

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, " ").slice(0, 120) || "file";
}

function startsWith(buf: Uint8Array, sig: number[], offset = 0) {
  return sig.every((b, i) => buf[offset + i] === b);
}

export function sniff(buf: Uint8Array): FileKind | "zip" | null {
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46])) return "pdf"; // %PDF
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) return "zip"; // DOCX is a ZIP container
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47])) return "image"; // PNG
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "image"; // JPEG
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) return "image"; // WEBP
  return null;
}

function looksLikeText(buf: Uint8Array): boolean {
  const sample = buf.subarray(0, 4096);
  if (sample.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(sample.length < buf.length ? sample.subarray(0, Math.max(0, sample.length - 4)) : sample);
    return true;
  } catch {
    return false;
  }
}

export function validateUpload(name: string, buf: Uint8Array, maxBytes: number): ValidationResult {
  const safeName = sanitizeFileName(name);
  const ext = safeName.split(".").pop()?.toLowerCase() ?? "";
  const accepted = ACCEPTED[ext];
  if (!accepted) return { ok: false, reason: "Unsupported file type. Upload PDF, DOCX, TXT/MD or an image (PNG, JPG, WEBP)." };
  if (buf.byteLength === 0) return { ok: false, reason: "The file is empty." };
  if (buf.byteLength > maxBytes) return { ok: false, reason: `The file is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.` };
  const sniffed = sniff(buf);
  const matches =
    (accepted.kind === "pdf" && sniffed === "pdf") ||
    (accepted.kind === "docx" && sniffed === "zip") ||
    (accepted.kind === "image" && sniffed === "image") ||
    (accepted.kind === "text" && sniffed === null && looksLikeText(buf));
  if (!matches) return { ok: false, reason: "The file contents do not match its extension." };
  return { ok: true, kind: accepted.kind, mime: accepted.mime, ext, safeName };
}
