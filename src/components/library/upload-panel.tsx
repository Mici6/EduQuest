"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CircleCheck, CircleX, CloudUpload, FileUp, LoaderCircle } from "lucide-react";
import { documentTextAction } from "@/actions/ai";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/format";

const STEPS = [
  { id: "validating", label: "Validate" },
  { id: "storing", label: "Store" },
  { id: "extracting", label: "Extract text" },
  { id: "chunking", label: "Chunk" },
  { id: "indexing", label: "Index" },
] as const;

type StepId = (typeof STEPS)[number]["id"];
type Progress = { step: StepId | "done" | "error" | null; message: string; reached: number };

const ACCEPT = ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp";

export function UploadPanel({
  role,
  subjects,
  classes,
  compact,
  onIndexed,
}: {
  role: "student" | "teacher" | "admin";
  subjects: { id: string; name: string }[];
  classes: { id: string; name: string }[];
  compact?: boolean;
  onIndexed?: (documentId: string, text: string | null) => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [visibility, setVisibility] = useState(role === "teacher" ? "class" : role === "admin" ? "school" : "private");
  const [progress, setProgress] = useState<Progress>({ step: null, message: "", reached: 0 });
  const [dragging, setDragging] = useState(false);
  const busy = progress.step !== null && progress.step !== "done" && progress.step !== "error";

  const upload = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("title", title);
    if (subjectId) fd.set("subjectId", subjectId);
    if (role === "teacher" && visibility === "class") fd.set("classId", classId);
    fd.set("visibility", visibility);
    setProgress({ step: "validating", message: "Uploading…", reached: 0 });
    try {
      const res = await fetch("/api/documents", { method: "POST", body: fd });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Upload failed." }));
        setProgress((p) => ({ ...p, step: "error", message: err.error ?? "Upload failed." }));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let finalDoc: string | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as { step: StepId | "done" | "error"; message: string; documentId?: string; status?: string };
          setProgress((p) => {
            const idx = STEPS.findIndex((x) => x.id === ev.step);
            return { step: ev.step, message: ev.message, reached: idx >= 0 ? idx : p.reached };
          });
          if (ev.step === "done") finalDoc = ev.documentId ?? null;
          if (ev.step === "error") toast({ tone: "error", title: ev.status === "needs_ocr" ? "Text recognition needed" : "Processing stopped", body: ev.message });
        }
      }
      if (finalDoc) {
        toast({ tone: "success", title: "Document ready", body: "It's now searchable by the AI study tools." });
        setFile(null);
        setTitle("");
        if (onIndexed) {
          const text = await documentTextAction(finalDoc);
          onIndexed(finalDoc, text.ok ? text.data : null);
        }
      }
      router.refresh();
    } catch {
      setProgress((p) => ({ ...p, step: "error", message: "Connection lost during upload." }));
    }
  };

  const stepIndex = progress.step === "done" ? STEPS.length : progress.reached;

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) setFile(f);
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-[22px] border-2 border-dashed px-4 text-center transition-colors",
          compact ? "py-6" : "py-10",
          dragging ? "border-sun-300 bg-sun-300/[0.06]" : "border-line-strong bg-ink-900/40",
        )}
      >
        <CloudUpload className="mb-2 size-8 text-fg-3" aria-hidden />
        <p className="text-sm font-semibold">{file ? file.name : "Drop a file here"}</p>
        <p className="mt-1 text-xs text-fg-3">{file ? `${(file.size / 1024).toFixed(0)} KB` : "PDF, DOCX, TXT/MD or an image (PNG, JPG, WEBP) · max 10 MB"}</p>
        <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" id="upload-input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => inputRef.current?.click()} disabled={busy}>
          <FileUp /> Choose file
        </Button>
      </div>

      {!compact ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title (optional)" htmlFor="up-title">
            <Input id="up-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to the file name" maxLength={140} />
          </Field>
          <Field label="Subject" htmlFor="up-subject">
            <Select id="up-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">No subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          {role === "teacher" ? (
            <>
              <Field label="Share with" htmlFor="up-vis">
                <Select id="up-vis" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                  <option value="class">One of my classes</option>
                  <option value="school">Whole school</option>
                  <option value="private">Only me</option>
                </Select>
              </Field>
              {visibility === "class" ? (
                <Field label="Class" htmlFor="up-class">
                  <Select id="up-class" value={classId} onChange={(e) => setClassId(e.target.value)}>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-fg-3 sm:col-span-2">{role === "student" ? "Your uploads are private to you." : "Administrator uploads are shared with the whole school."}</p>
          )}
        </div>
      ) : null}

      {progress.step ? (
        <div className="rounded-2xl border border-line bg-ink-900/60 p-4" role="status" aria-live="polite">
          <ol className="flex items-center gap-1.5">
            {STEPS.map((s, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex && busy;
              const failed = progress.step === "error" && i === stepIndex;
              return (
                <li key={s.id} className="flex flex-1 flex-col items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex size-7 items-center justify-center rounded-full text-[11px] font-bold",
                      done ? "bg-mint text-ink-950" : active ? "bg-sun-200 text-ink-950" : failed ? "bg-rose/30 text-rose" : "bg-ink-700 text-fg-3",
                    )}
                  >
                    {done ? <CircleCheck className="size-4" /> : active ? <LoaderCircle className="size-4 animate-spin" /> : i + 1}
                  </span>
                  <span className="text-center text-[10px] text-fg-3">{s.label}</span>
                </li>
              );
            })}
          </ol>
          <p className={cn("mt-3 flex items-center gap-1.5 text-xs", progress.step === "error" ? "text-rose" : progress.step === "done" ? "text-mint" : "text-fg-2")}>
            {progress.step === "error" ? <CircleX className="size-3.5" /> : null}
            {progress.message}
          </p>
        </div>
      ) : null}

      <Button className="w-full" onClick={upload} disabled={!file || busy} loading={busy}>
        Upload & process
      </Button>
    </div>
  );
}
