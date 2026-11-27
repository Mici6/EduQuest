"use client";

import { useState } from "react";
import { Clock, MapPin, UserRound } from "lucide-react";
import { PillTabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils/format";

export type Slot = {
  id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  room: string;
  subject_name: string;
  subject_short: string;
  subject_color: string;
  teacher_name: string;
  class_name: string;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

function isNow(s: Slot, todayWd: number, hhmm: string) {
  return s.weekday === todayWd && s.starts_at <= hhmm && s.ends_at > hhmm;
}

export function WeekSchedule({ slots, todayWd, hhmm, showClass }: { slots: Slot[]; todayWd: number; hhmm: string; showClass: boolean }) {
  const [day, setDay] = useState(String(todayWd <= 5 ? todayWd : 1));
  const periods = [...new Set(slots.map((s) => `${s.starts_at}–${s.ends_at}`))].sort();
  const daySlots = slots.filter((s) => String(s.weekday) === day);

  return (
    <>
      {/* Mobile: one day at a time */}
      <div className="@2xl:hidden">
        <PillTabs label="Day" value={day} onChange={setDay} className="mb-4 w-full justify-between" items={DAYS.map((d, i) => ({ value: String(i + 1), label: d }))} />
        <ol className="space-y-2.5">
          {daySlots.map((s) => (
            <li
              key={s.id}
              className={cn("flex gap-3 rounded-[20px] border bg-ink-900/60 p-3.5", isNow(s, todayWd, hhmm) ? "border-sun-300/60 ring-1 ring-sun-300/30" : "border-line")}
            >
              <div className="w-12 shrink-0 text-xs tabular-nums text-fg-2">
                <p className="font-semibold text-fg">{s.starts_at}</p>
                <p>{s.ends_at}</p>
              </div>
              <span className="w-1 shrink-0 rounded-full" style={{ background: s.subject_color }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{s.subject_name}</p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-fg-3">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" aria-hidden />
                    {s.room}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <UserRound className="size-3" aria-hidden />
                    {showClass ? s.class_name : s.teacher_name}
                  </span>
                </p>
              </div>
              {isNow(s, todayWd, hhmm) ? <span className="self-start rounded-full bg-sun-200 px-2 py-0.5 text-[10px] font-bold text-ink-950">NOW</span> : null}
            </li>
          ))}
        </ol>
      </div>

      {/* Desktop: full week grid */}
      <div className="hidden overflow-x-auto @2xl:block">
        <table className="w-full border-separate border-spacing-1.5 text-sm">
          <caption className="sr-only">Weekly timetable</caption>
          <thead>
            <tr>
              <th scope="col" className="w-20 text-left text-xs font-semibold text-fg-3">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" aria-hidden /> Time
                </span>
              </th>
              {DAYS.map((d, i) => (
                <th key={d} scope="col" className={cn("rounded-full py-1.5 text-xs font-semibold", i + 1 === todayWd ? "bg-sun-200 text-ink-950" : "text-fg-2")}>
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p}>
                <th scope="row" className="pr-2 text-left align-top text-[11px] font-medium tabular-nums text-fg-3">
                  {p.replace("–", "\n")}
                </th>
                {DAYS.map((_, i) => {
                  const s = slots.find((x) => x.weekday === i + 1 && `${x.starts_at}–${x.ends_at}` === p);
                  if (!s) return <td key={i} className="rounded-2xl border border-dashed border-line/60" />;
                  const now = isNow(s, todayWd, hhmm);
                  return (
                    <td key={i} className="align-top">
                      <div
                        className={cn("h-full rounded-2xl border bg-ink-900/70 p-2.5 transition-colors", now ? "border-sun-300/70 bg-sun-300/[0.08]" : "border-line")}
                        style={{ boxShadow: `inset 3px 0 0 ${s.subject_color}` }}
                      >
                        <p className="truncate pl-1 text-[13px] font-semibold">{s.subject_name}</p>
                        <p className="truncate pl-1 text-[11px] text-fg-3">
                          {s.room} · {showClass ? s.class_name : s.teacher_name.split(" ").slice(-1)[0]}
                        </p>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
