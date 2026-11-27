"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlashcardGenerator } from "./flashcard-generator";
import type { DocOption } from "./source-picker";

export function FlashcardsToolbar({ docs, initialOpen, initialDocId, disabled }: { docs: DocOption[]; initialOpen: boolean; initialDocId: string | null; disabled: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Create set
      </Button>
      <FlashcardGenerator docs={docs} initialDocId={initialDocId} open={open} onClose={() => setOpen(false)} role="student" disabled={disabled} />
    </>
  );
}
