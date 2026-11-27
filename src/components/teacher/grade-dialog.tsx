"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { addGradeAction } from "@/actions/teacher";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export function AddGradeButton({ student, classId, subjectId, subjectName, compact }: { student: { id: string; name: string }; classId: string; subjectId: string; subjectName: string; compact?: boolean }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("8");
  const [kind, setKind] = useState("quiz");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const res = await addGradeAction({ studentId: student.id, classId, subjectId, value: Number(value), kind, title, gradedOn: date });
      if (!res.ok) return toast({ tone: "error", title: "Grade not saved", body: res.error });
      toast({ tone: "success", title: `Grade ${value} saved for ${student.name}`, body: "The student has been notified." });
      setOpen(false);
      setTitle("");
    });
  return (
    <>
      <Button variant={compact ? "ghost" : "secondary"} size="sm" onClick={() => setOpen(true)} aria-label={`Add grade for ${student.name}`}>
        <Plus /> {compact ? "Grade" : "Add grade"}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Add a grade · ${student.name}`}
        description={subjectName}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={pending} disabled={!title.trim()}>
              Save grade
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Grade (1–10)" htmlFor="g-val">
            <Select id="g-val" value={value} onChange={(e) => setValue(e.target.value)}>
              {[10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4, 3, 2, 1].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type" htmlFor="g-kind" hint="Tests are weighted ×2">
            <Select id="g-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="test">Test</option>
              <option value="quiz">Quiz</option>
              <option value="oral">Oral</option>
              <option value="project">Project</option>
              <option value="homework">Homework</option>
            </Select>
          </Field>
          <Field label="Assessment" htmlFor="g-title" className="sm:col-span-2">
            <Input id="g-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Linear equations test" maxLength={120} />
          </Field>
          <Field label="Date" htmlFor="g-date">
            <Input id="g-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
