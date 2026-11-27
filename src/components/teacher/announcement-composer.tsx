"use client";

import { useState, useTransition } from "react";
import { Megaphone } from "lucide-react";
import { postAnnouncementAction } from "@/actions/teacher";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

export function AnnouncementComposer({ classes, schoolWide }: { classes: { id: string; name: string }[]; schoolWide: boolean }) {
  const toast = useToast();
  const [classId, setClassId] = useState(schoolWide ? "" : (classes[0]?.id ?? ""));
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [pending, start] = useTransition();
  const post = () =>
    start(async () => {
      const res = await postAnnouncementAction({ classId: classId || null, title, body, pinned });
      if (!res.ok) return toast({ tone: "error", title: "Not posted", body: res.error });
      toast({ tone: "success", title: "Announcement posted", body: "Recipients were notified (respecting their preferences)." });
      setTitle("");
      setBody("");
      setPinned(false);
    });
  return (
    <div className="space-y-4">
      {!schoolWide ? (
        <Field label="Class" htmlFor="an-class">
          <Select id="an-class" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label="Title" htmlFor="an-title">
        <Input id="an-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
      </Field>
      <Field label="Message" htmlFor="an-body">
        <Textarea id="an-body" value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={4000} />
      </Field>
      <Switch id="an-pin" label="Pin to the top" checked={pinned} onChange={setPinned} />
      <Button className="w-full" onClick={post} loading={pending} disabled={title.trim().length < 3 || body.trim().length < 3 || (!schoolWide && !classId)}>
        <Megaphone /> Post announcement
      </Button>
    </div>
  );
}
