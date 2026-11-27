"use client";

import { FileText, Search, StickyNote } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { PillTabs } from "@/components/ui/tabs";

export type DocOption = { id: string; title: string; subject_name: string | null };
export type SourceState = { mode: "document" | "topic" | "text"; documentId: string; topic: string; text: string };

export const emptySource = (docs: DocOption[], documentId?: string | null): SourceState => ({
  mode: docs.length ? "document" : "text",
  documentId: documentId && docs.some((d) => d.id === documentId) ? documentId : (docs[0]?.id ?? ""),
  topic: "",
  text: "",
});

export function sourceSpec(s: SourceState) {
  return s.mode === "document" ? { documentId: s.documentId } : s.mode === "topic" ? { topic: s.topic } : { text: s.text, topic: "My notes" };
}

export function sourceReady(s: SourceState) {
  return s.mode === "document" ? !!s.documentId : s.mode === "topic" ? s.topic.trim().length >= 3 : s.text.trim().length >= 80;
}

export function SourcePicker({ docs, value, onChange }: { docs: DocOption[]; value: SourceState; onChange: (s: SourceState) => void }) {
  return (
    <div className="space-y-4">
      <PillTabs
        label="Source"
        size="sm"
        value={value.mode}
        onChange={(mode) => onChange({ ...value, mode })}
        items={[
          { value: "document", label: <span className="inline-flex items-center gap-1.5"><FileText className="size-3.5" />Lesson material</span> },
          { value: "topic", label: <span className="inline-flex items-center gap-1.5"><Search className="size-3.5" />Topic</span> },
          { value: "text", label: <span className="inline-flex items-center gap-1.5"><StickyNote className="size-3.5" />Paste notes</span> },
        ]}
      />
      {value.mode === "document" ? (
        <Field label="Document" htmlFor="src-doc" hint={docs.length ? "Only materials you're allowed to see are listed." : "No processed documents yet — upload one in the Library."}>
          <Select id="src-doc" value={value.documentId} onChange={(e) => onChange({ ...value, documentId: e.target.value })} disabled={!docs.length}>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
                {d.subject_name ? ` — ${d.subject_name}` : ""}
              </option>
            ))}
          </Select>
        </Field>
      ) : value.mode === "topic" ? (
        <Field label="Topic" htmlFor="src-topic" hint="We search your class materials for this topic and use the most relevant sections.">
          <Input id="src-topic" value={value.topic} onChange={(e) => onChange({ ...value, topic: e.target.value })} placeholder="e.g. limiting factors, Newton's second law" maxLength={200} />
        </Field>
      ) : (
        <Field label="Your notes" htmlFor="src-text" hint={`${value.text.trim().length} characters · at least 80 needed`}>
          <Textarea id="src-text" value={value.text} onChange={(e) => onChange({ ...value, text: e.target.value })} rows={7} placeholder="Paste your notes or a passage from your textbook…" maxLength={60000} />
        </Field>
      )}
    </div>
  );
}
