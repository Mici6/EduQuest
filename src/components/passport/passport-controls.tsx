"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, Check, Copy, ExternalLink, Plus, Stamp, Trash2, Undo2 } from "lucide-react";
import { addProjectAction, deleteProjectAction, issuePassportAction, revokeCredentialAction, verifyProjectAction } from "@/actions/passport";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export function AddProjectForm() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ title: "", description: "", link: "" });
  const save = () =>
    start(async () => {
      const res = await addProjectAction(f);
      if (!res.ok) return toast({ tone: "error", title: "Couldn't add project", body: res.error });
      setF({ title: "", description: "", link: "" });
      toast({ tone: "success", title: "Project added", body: "Ask a teacher to verify it so it counts as verified." });
    });
  return (
    <Card tone="flat">
      <CardHeader title="Add a project" subtitle="School, club or personal projects. Teachers can verify them." />
      <div className="space-y-3">
        <Field label="Title" htmlFor="prj-title">
          <Input id="prj-title" value={f.title} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Recycling campaign poster series" />
        </Field>
        <Field label="What did you do?" htmlFor="prj-desc">
          <Textarea id="prj-desc" value={f.description} maxLength={1000} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Your role, what you made and what came of it." />
        </Field>
        <Field label="Link (optional)" htmlFor="prj-link" hint="A public page, video or repository.">
          <Input id="prj-link" type="url" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="https://" />
        </Field>
        <Button onClick={save} loading={pending} disabled={f.title.trim().length < 3 || f.description.trim().length < 10}>
          <Plus /> Add project
        </Button>
      </div>
    </Card>
  );
}

export function ProjectControls({ id, mode, verified }: { id: string; mode: "student" | "teacher"; verified: boolean }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const res = await fn();
      setConfirm(false);
      toast(res.ok ? { tone: "success", title: ok } : { tone: "error", title: "Something went wrong", body: res.error });
    });
  if (mode === "teacher") {
    return verified ? (
      <Button size="sm" variant="ghost" loading={pending} onClick={() => act(() => verifyProjectAction(id, false), "Verification removed")}>
        <Undo2 /> Unverify
      </Button>
    ) : (
      <Button size="sm" variant="secondary" loading={pending} onClick={() => act(() => verifyProjectAction(id, true), "Project verified")}>
        <BadgeCheck /> Verify
      </Button>
    );
  }
  return (
    <>
      <Button size="icon-sm" variant="ghost" aria-label="Delete project" onClick={() => setConfirm(true)}>
        <Trash2 />
      </Button>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => act(() => deleteProjectAction(id), "Project removed")} pending={pending} title="Remove this project?" confirmLabel="Remove" variant="danger">
        It will no longer appear in your passport. Passports you already issued keep their snapshot.
      </ConfirmDialog>
    </>
  );
}

function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(new URL(path, window.location.origin).toString()).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

export function IssuePassportButton() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [issued, setIssued] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await issuePassportAction();
            if (!res.ok) return toast({ tone: "error", title: "Couldn't issue passport", body: res.error });
            setIssued(res.data);
            toast({ tone: "success", title: "Passport issued", body: "Share the link or print it as a PDF." });
          })
        }
      >
        <Stamp /> Issue sealed passport
      </Button>
      {issued ? (
        <>
          <ButtonLink href={`/verify/${issued}`} target="_blank" variant="secondary" size="sm">
            <ExternalLink /> Open
          </ButtonLink>
          <CopyLink path={`/verify/${issued}`} />
        </>
      ) : null}
    </div>
  );
}

export function CredentialActions({ id, canRevoke, revoked }: { id: string; canRevoke: boolean; revoked: boolean }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ButtonLink href={`/verify/${id}`} target="_blank" variant="ghost" size="sm">
        <ExternalLink /> Open
      </ButtonLink>
      {!revoked ? <CopyLink path={`/verify/${id}`} /> : null}
      {canRevoke && !revoked ? (
        <>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
            Revoke
          </Button>
          <ConfirmDialog
            open={confirm}
            onClose={() => setConfirm(false)}
            onConfirm={() =>
              start(async () => {
                const res = await revokeCredentialAction(id);
                setConfirm(false);
                toast(res.ok ? { tone: "success", title: "Document revoked" } : { tone: "error", title: "Couldn't revoke", body: res.error });
              })
            }
            pending={pending}
            title="Revoke this document?"
            confirmLabel="Revoke"
            variant="danger"
          >
            Anyone opening its link will see that it was revoked. This can't be undone.
          </ConfirmDialog>
        </>
      ) : null}
    </div>
  );
}
