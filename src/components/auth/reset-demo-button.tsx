"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { resetDemoData } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";

export function ResetDemoButton({ variant = "ghost", label = "Reset demo data" }: { variant?: "ghost" | "secondary" | "danger"; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
        <RotateCcw /> {label}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Reset the demo school?"
        confirmLabel="Reset demo data"
        variant="danger"
        pending={pending}
        onConfirm={() => start(() => resetDemoData())}
      >
        All demo changes (grades entered, quizzes taken, courses created, uploads) are discarded and fresh sample data is generated with current dates. Everyone is signed out. This only affects demo mode.
      </ConfirmDialog>
    </>
  );
}
