"use client";

import { useState, useTransition } from "react";
import { CircleCheck, Send } from "lucide-react";
import { submitContactAction } from "@/actions/contact";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";

export function ContactForm() {
  const [f, setF] = useState({ name: "", email: "", organisation: "", role: "school_leader", message: "", consent: false });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) {
    return (
      <div className="flex flex-col items-center py-8 text-center" role="status">
        <CircleCheck className="size-10 text-mint" aria-hidden />
        <p className="mt-3 font-display text-xl font-semibold">Thanks — we'll be in touch.</p>
        <p className="mt-1 max-w-sm text-sm text-fg-2">This demo deployment stores your request locally; nothing is emailed or shared with third parties.</p>
      </div>
    );
  }
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await submitContactAction(f);
          if (res.ok) setDone(true);
          else setError(res.error);
        });
      }}
    >
      <Field label="Name" htmlFor="c-name">
        <Input id="c-name" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={80} />
      </Field>
      <Field label="Work email" htmlFor="c-email">
        <Input id="c-email" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
      </Field>
      <Field label="School or organisation" htmlFor="c-org">
        <Input id="c-org" autoComplete="organization" value={f.organisation} onChange={(e) => setF({ ...f, organisation: e.target.value })} required maxLength={120} />
      </Field>
      <Field label="I am…" htmlFor="c-role">
        <Select id="c-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          <option value="school_leader">A school leader</option>
          <option value="teacher">A teacher</option>
          <option value="business">A local business</option>
          <option value="ngo">An NGO / volunteering organisation</option>
          <option value="parent_student">A parent or student</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <Field label="Message (optional)" htmlFor="c-msg" className="sm:col-span-2">
        <Textarea id="c-msg" rows={4} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} maxLength={2000} />
      </Field>
      <label className="flex items-start gap-3 text-xs text-fg-2 sm:col-span-2">
        <input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} className="mt-0.5 size-4 accent-[var(--color-sun-300)]" />
        I agree that EduQuest may use these details only to reply to this request. Please don't include information about students.
      </label>
      {error ? (
        <Notice tone="danger" className="sm:col-span-2">
          {error}
        </Notice>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" loading={pending}>
          <Send /> Send request
        </Button>
      </div>
    </form>
  );
}
