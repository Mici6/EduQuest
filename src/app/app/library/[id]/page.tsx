import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { DomainError } from "@/lib/auth/errors";
import { getDb } from "@/lib/db";
import { getDocument } from "@/lib/domain/documents";
import { notFound } from "next/navigation";
import { fmtDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Document" };

export default async function DocumentPage({ params }: PageProps<"/app/library/[id]">) {
  const actor = await requireActor(["student", "teacher", "admin"]);
  const { id } = await params;
  const db = getDb();
  let doc;
  try {
    doc = getDocument(db, actor, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const chunks = db.all<{ id: string; position: number; heading: string | null; content: string; token_count: number }>(
    `SELECT id, position, heading, content, token_count FROM document_chunks WHERE document_id = ? ORDER BY position`,
    doc.id,
  );
  return (
    <div>
      <Link href="/app/library" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg">
        <ArrowLeft className="size-4" /> Library
      </Link>
      <PageHeader
        eyebrow={doc.subject_name ?? "Document"}
        title={doc.title}
        description={`${doc.owner_name} · ${fmtDate(doc.created_at, { day: "numeric", month: "long", year: "numeric" })} · ${doc.char_count.toLocaleString()} characters · ${doc.chunk_count} indexed sections`}
        actions={
          doc.status === "indexed" && actor.role === "student" ? (
            <ButtonLink href={`/app/study/chat?doc=${doc.id}`} variant="iris">
              Ask the tutor about this
            </ButtonLink>
          ) : null
        }
      />
      <Notice tone="info" className="mb-5" title="This is exactly what the AI tools can read">
        Text is extracted from the file and split into overlapping sections. The tutor retrieves the most relevant sections for each question and cites them.
      </Notice>
      {doc.status !== "indexed" ? <Notice tone="warn" title={`Status: ${doc.status.replace("_", " ")}`}>{doc.status_detail}</Notice> : null}
      <ol className="space-y-3">
        {chunks.map((c) => (
          <li key={c.id}>
            <Card className="!p-4 sm:!p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-fg-3">
                <Badge>Section {c.position + 1}</Badge>
                {c.heading ? <span className="font-semibold text-fg-2">{c.heading}</span> : null}
                <span className="ml-auto">~{c.token_count} tokens</span>
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-fg-2">{c.content}</p>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
