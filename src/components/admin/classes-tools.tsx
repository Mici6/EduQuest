"use client";

import { useState, useTransition } from "react";
import { Link2, Plus } from "lucide-react";
import { assignTeacherAction, createClassAction, createSubjectAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export function NewClassButton({ teachers }: { teachers: { id: string; display_name: string }[] }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState(10);
  const [teacher, setTeacher] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus /> Class
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New class"
        size="sm"
        footer={
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await createClassAction({ name, gradeLevel: grade, homeroomTeacherId: teacher || null });
                if (!res.ok) return toast({ tone: "error", title: "Couldn't create", body: res.error });
                toast({ tone: "success", title: `${name} created` });
                setOpen(false);
              })
            }
          >
            Create class
          </Button>
        }
      >
        <div className="grid gap-4">
          <Field label="Name" htmlFor="c-name">
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Class 9C" />
          </Field>
          <Field label="Grade level" htmlFor="c-grade">
            <Select id="c-grade" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
              {[5, 6, 7, 8, 9, 10, 11, 12, 13].map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Homeroom teacher" htmlFor="c-teacher">
            <Select id="c-teacher" value={teacher} onChange={(e) => setTeacher(e.target.value)}>
              <option value="">None yet</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.display_name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Dialog>
    </>
  );
}

export function NewSubjectButton() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [short, setShort] = useState("");
  const [color, setColor] = useState("#9B8CFF");
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus /> Subject
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New subject"
        size="sm"
        footer={
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await createSubjectAction({ name, short, color });
                if (!res.ok) return toast({ tone: "error", title: "Couldn't create", body: res.error });
                toast({ tone: "success", title: `${name} created` });
                setOpen(false);
              })
            }
          >
            Create subject
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_100px_80px]">
          <Field label="Name" htmlFor="s-name">
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Music" />
          </Field>
          <Field label="Code" htmlFor="s-short">
            <Input id="s-short" value={short} onChange={(e) => setShort(e.target.value.toUpperCase())} maxLength={4} />
          </Field>
          <Field label="Colour" htmlFor="s-color">
            <Input id="s-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="!px-1.5" />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

export function AssignTeacherButton({ teachers, classes, subjects }: { teachers: { id: string; display_name: string }[]; classes: { id: string; name: string }[]; subjects: { id: string; name: string }[] }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ teacherId: teachers[0]?.id ?? "", classId: classes[0]?.id ?? "", subjectId: subjects[0]?.id ?? "" });
  const [pending, start] = useTransition();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Link2 /> Assign teacher
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Assign a teacher to a class"
        description="Teachers can only see academic records for classes they're assigned to."
        size="sm"
        footer={
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await assignTeacherAction(f);
                if (!res.ok) return toast({ tone: "error", title: "Couldn't assign", body: res.error });
                toast({ tone: "success", title: "Teacher assigned" });
                setOpen(false);
              })
            }
          >
            Assign
          </Button>
        }
      >
        <div className="grid gap-4">
          <Field label="Teacher" htmlFor="a-t">
            <Select id="a-t" value={f.teacherId} onChange={(e) => setF({ ...f, teacherId: e.target.value })}>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.display_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Class" htmlFor="a-c">
            <Select id="a-c" value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value })}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Subject" htmlFor="a-s">
            <Select id="a-s" value={f.subjectId} onChange={(e) => setF({ ...f, subjectId: e.target.value })}>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Dialog>
    </>
  );
}
