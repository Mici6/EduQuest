"use client";

import { useState, useTransition } from "react";
import { CheckCheck, Save } from "lucide-react";
import { recordAttendanceAction } from "@/actions/teacher";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/format";

type Status = "present" | "late" | "absent" | "excused";
const OPTIONS: { value: Status; label: string; cls: string }[] = [
  { value: "present", label: "Present", cls: "bg-mint text-ink-950" },
  { value: "late", label: "Late", cls: "bg-amber text-ink-950" },
  { value: "absent", label: "Absent", cls: "bg-rose text-ink-950" },
  { value: "excused", label: "Excused", cls: "bg-sky text-ink-950" },
];

export function AttendanceSheet({ rows, classId, subjectId, date }: { rows: { id: string; display_name: string; avatar_hue: number; status: string | null }[]; classId: string; subjectId: string; date: string }) {
  const toast = useToast();
  const [state, setState] = useState<Record<string, Status>>(() => Object.fromEntries(rows.map((r) => [r.id, (r.status as Status) ?? "present"])));
  const [pending, start] = useTransition();
  const recorded = rows.some((r) => r.status);
  const save = () =>
    start(async () => {
      const res = await recordAttendanceAction({ classId, subjectId, date, entries: Object.entries(state).map(([studentId, status]) => ({ studentId, status })) });
      toast(res.ok ? { tone: "success", title: "Attendance saved", body: `${rows.length} students recorded for ${date}.` } : { tone: "error", title: "Not saved", body: res.error });
    });
  const counts = OPTIONS.map((o) => ({ ...o, n: Object.values(state).filter((s) => s === o.value).length }));
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs">
          {counts.map((c) => (
            <span key={c.value} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1">
              <span className={cn("size-2 rounded-full", c.cls)} aria-hidden /> {c.label} {c.n}
            </span>
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setState(Object.fromEntries(rows.map((r) => [r.id, "present" as Status])))}>
          <CheckCheck /> Mark all present
        </Button>
      </div>
      <ul className="divide-y divide-line/60">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-3">
              <Avatar name={r.display_name} hue={r.avatar_hue} size={34} />
              <span className="text-sm font-medium">{r.display_name}</span>
            </span>
            <div role="radiogroup" aria-label={`Attendance for ${r.display_name}`} className="inline-flex gap-1 rounded-full border border-line bg-ink-900/70 p-1">
              {OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={state[r.id] === o.value}
                  onClick={() => setState((s) => ({ ...s, [r.id]: o.value }))}
                  className={cn("h-8 rounded-full px-3 text-xs font-semibold transition-colors", state[r.id] === o.value ? o.cls : "text-fg-3 hover:text-fg")}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-xs text-fg-3">{recorded ? "Attendance was already recorded for this date — saving updates it." : "Not yet recorded for this date."} Attendance never changes XP or credits.</p>
        <Button onClick={save} loading={pending}>
          <Save /> Save attendance
        </Button>
      </div>
    </div>
  );
}
