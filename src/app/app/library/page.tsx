import type { Metadata } from "next";
import { FileText, Image as ImageIcon, LibraryBig } from "lucide-react";
import { DocActions } from "@/components/library/doc-actions";
import { UploadPanel } from "@/components/library/upload-panel";
import { Badge, SubjectTag } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Notice } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { allClasses, schoolSettings } from "@/lib/domain/admin";
import { subjectsForSchool, teacherClasses } from "@/lib/domain/catalog";
import { listDocuments, type DocumentRow } from "@/lib/domain/documents";
import { fmtDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Library" };

const STATUS: Record<DocumentRow["status"], { tone: "mint" | "sun" | "ember" | "rose" | "neutral"; label: string }> = {
  indexed: { tone: "mint", label: "Ready" },
  uploaded: { tone: "neutral", label: "Uploaded" },
  validating: { tone: "sun", label: "Validating" },
  extracting: { tone: "sun", label: "Extracting" },
  chunking: { tone: "sun", label: "Chunking" },
  needs_ocr: { tone: "ember", label: "Needs OCR" },
  failed: { tone: "rose", label: "Failed" },
};

const VIS: Record<string, string> = { private: "Only me", class: "Class", school: "Whole school" };

export default async function LibraryPage() {
  const actor = await requireActor(["student", "teacher", "admin"]);
  const db = getDb();
  const docs = listDocuments(db, actor);
  const subjects = subjectsForSchool(db, actor.schoolId).map((s) => ({ id: s.id, name: s.name }));
  const classes =
    actor.role === "teacher"
      ? [...new Map(teacherClasses(db, actor).map((c) => [c.class_id, { id: c.class_id, name: c.class_name }])).values()]
      : actor.role === "admin"
        ? allClasses(db, actor.schoolId).map((c) => ({ id: c.id, name: c.name }))
        : [];
  const uploadsAllowed = actor.role !== "student" || schoolSettings(db, actor.schoolId).studentUploadsEnabled;

  return (
    <div>
      <PageHeader
        eyebrow="Documents"
        title="Library"
        description={
          actor.role === "student"
            ? "Lesson materials shared by your teachers, plus anything you upload privately. Everything here can power your AI study tools."
            : "Upload lessons and materials. Processed documents become searchable for the AI tools of the students you share them with."
        }
      />
      <div className="grid gap-5 @5xl:grid-cols-12">
        <div className="space-y-4 @5xl:col-span-8">
          {docs.length ? (
            <ul className="space-y-2.5">
              {docs.map((d) => (
                <li key={d.id} className="surface flex items-center gap-3 rounded-[22px] p-3.5 sm:gap-4 sm:p-4">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-fg-2">
                    {d.mime_type.startsWith("image/") ? <ImageIcon className="size-5" aria-hidden /> : <FileText className="size-5" aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{d.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-3">
                      {d.subject_name ? <SubjectTag name={d.subject_name} color={d.subject_color!} /> : null}
                      <span>{d.owner_id === actor.id ? "You" : d.owner_name}</span>
                      <span>· {fmtDate(d.created_at)}</span>
                      <span>· {d.file_name.split(".").pop()?.toUpperCase()}</span>
                      <span>· {VIS[d.visibility]}{d.class_name ? ` (${d.class_name})` : ""}</span>
                      {d.status === "indexed" ? <span>· {d.chunk_count} sections</span> : null}
                    </p>
                    {d.status_detail && d.status !== "indexed" ? <p className="mt-1 text-xs text-amber">{d.status_detail}</p> : null}
                  </div>
                  <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge>
                  <DocActions id={d.id} title={d.title} canDelete={d.owner_id === actor.id || actor.role === "admin"} canStudy={d.status === "indexed" && actor.role !== "admin"} studio={actor.role === "teacher"} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<LibraryBig />} title="No documents yet">
              Upload a lesson, your notes or a photo of a worksheet to get started.
            </EmptyState>
          )}
        </div>
        <div className="space-y-4 @5xl:col-span-4">
          <Card>
            <CardHeader title="Upload material" subtitle="Validated, text-extracted, split into sections and indexed for retrieval" />
            {uploadsAllowed ? (
              <UploadPanel role={actor.role === "support" ? "student" : actor.role} subjects={subjects} classes={classes} />
            ) : (
              <Notice tone="warn">Your school has turned off student uploads.</Notice>
            )}
          </Card>
          <Notice tone="info" title="How processing works">
            PDF, DOCX and text files are processed on the server. Images and scanned PDFs need OCR, which isn't available, so those files are marked “Needs OCR”. Search uses a lexical (BM25) index; vector embeddings can be added with an embeddings provider.
          </Notice>
        </div>
      </div>
    </div>
  );
}
