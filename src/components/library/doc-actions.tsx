"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Ellipsis, FileText, Layers, ListChecks, MessagesSquare, Sparkles, Trash2 } from "lucide-react";
import { deleteDocumentAction } from "@/actions/ai";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Menu, MenuItem } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";

export function DocActions({ id, title, canDelete, canStudy, studio }: { id: string; title: string; canDelete: boolean; canStudy: boolean; studio: boolean }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const linkCls = "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-fg-2 hover:bg-white/[0.06] hover:text-fg [&_svg]:size-4";
  return (
    <>
      <Menu
        label={`Actions for ${title}`}
        trigger={
          <span className="inline-flex size-9 items-center justify-center rounded-full text-fg-3 hover:bg-white/[0.06] hover:text-fg">
            <Ellipsis className="size-[18px]" />
          </span>
        }
      >
        {(close) => (
          <>
            <Link href={`/app/library/${id}`} className={linkCls} onClick={close}>
              <FileText /> View extracted text
            </Link>
            {canStudy ? (
              studio ? (
                <Link href={`/app/teacher/studio?doc=${id}`} className={linkCls} onClick={close}>
                  <Sparkles /> Generate in AI Studio
                </Link>
              ) : (
                <>
                  <Link href={`/app/study/chat?doc=${id}`} className={linkCls} onClick={close}>
                    <MessagesSquare /> Ask the tutor
                  </Link>
                  <Link href={`/app/study/summary?doc=${id}`} className={linkCls} onClick={close}>
                    <Sparkles /> Summarise
                  </Link>
                  <Link href={`/app/flashcards?generate=1&doc=${id}`} className={linkCls} onClick={close}>
                    <Layers /> Make flashcards
                  </Link>
                  <Link href={`/app/study/quiz?doc=${id}`} className={linkCls} onClick={close}>
                    <ListChecks /> Practice quiz
                  </Link>
                </>
              )
            ) : null}
            {canDelete ? (
              <MenuItem
                danger
                icon={<Trash2 />}
                onClick={() => {
                  close();
                  setConfirm(true);
                }}
              >
                Delete
              </MenuItem>
            ) : null}
          </>
        )}
      </Menu>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete this document?"
        confirmLabel="Delete"
        variant="danger"
        pending={pending}
        onConfirm={() =>
          start(async () => {
            const res = await deleteDocumentAction(id);
            setConfirm(false);
            toast(res.ok ? { tone: "success", title: "Document deleted" } : { tone: "error", title: "Couldn't delete", body: res.error });
          })
        }
      >
        “{title}” and its search index will be removed. Flashcards and quizzes made from it are kept.
      </ConfirmDialog>
    </>
  );
}
