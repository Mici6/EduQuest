"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { createPersonAction, setUserActiveAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import type { Role } from "@/lib/auth/types";

export function AddPersonButton({ classes }: { classes: { id: string; name: string }[] }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<{ name: string; email: string; role: Role; classId: string }>({ name: "", email: "", role: "student", classId: classes[0]?.id ?? "" });
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const res = await createPersonAction({ ...f, classId: f.role === "student" ? f.classId : null });
      if (!res.ok) return toast({ tone: "error", title: "Couldn't add", body: res.error });
      toast({ tone: "success", title: `${f.name} added` });
      setOpen(false);
      setF({ ...f, name: "", email: "" });
    });
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus /> Add person
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add a person"
        description="In demo mode the account is created as demo data. Production accounts are provisioned through the school's identity provider."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={pending}>
              Add
            </Button>
          </>
        }
      >
        <div className="grid gap-4 @container sm:grid-cols-2">
          <Field label="Full name" htmlFor="p-name">
            <Input id="p-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} />
          </Field>
          <Field label="School email" htmlFor="p-email">
            <Input id="p-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Role" htmlFor="p-role">
            <Select id="p-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">School administrator</option>
              <option value="support">Student support staff</option>
            </Select>
          </Field>
          {f.role === "student" ? (
            <Field label="Class" htmlFor="p-class">
              <Select id="p-class" value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value })}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}

export function ToggleActiveButton({ userId, name, active, self }: { userId: string; name: string; active: boolean; self: boolean }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  if (self) return <span className="text-xs text-fg-3">You</span>;
  return (
    <>
      <Button size="sm" variant={active ? "ghost" : "secondary"} onClick={() => setOpen(true)}>
        {active ? "Deactivate" : "Reactivate"}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={active ? `Deactivate ${name}?` : `Reactivate ${name}?`}
        confirmLabel={active ? "Deactivate" : "Reactivate"}
        variant={active ? "danger" : "primary"}
        pending={pending}
        onConfirm={() =>
          start(async () => {
            const res = await setUserActiveAction(userId, !active);
            setOpen(false);
            toast(res.ok ? { tone: "success", title: active ? "Account deactivated" : "Account reactivated" } : { tone: "error", title: "Couldn't update", body: res.error });
          })
        }
      >
        {active ? "They will be signed out and unable to sign in. Their records are kept (and can be reactivated)." : "They will be able to sign in again."}
      </ConfirmDialog>
    </>
  );
}
