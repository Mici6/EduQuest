import { CalendarDays, Coins, Flame, House, Layers, ListChecks, MessagesSquare, ScanText, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils/format";

/** Stylised, static product previews for the landing page (no real data). */
function Phone({ children, className, tilt }: { children: React.ReactNode; className?: string; tilt?: string }) {
  return (
    <div className={cn("relative w-[228px] shrink-0 rounded-[42px] border border-white/15 bg-ink-950 p-2 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.9)]", tilt, className)} aria-hidden>
      <div className="relative h-[468px] overflow-hidden rounded-[34px] bg-ink-900">
        <div className="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
        <div className="flex items-center justify-between px-5 pt-2.5 text-[9px] font-semibold text-fg-2">
          <span>9:41</span>
          <span>5G</span>
        </div>
        <div className="px-3.5 pt-4">{children}</div>
      </div>
    </div>
  );
}

function BottomBar({ active }: { active: number }) {
  const icons = [House, CalendarDays, Sparkles, Trophy];
  return (
    <div className="absolute inset-x-3 bottom-3 flex justify-between rounded-full border border-white/10 bg-ink-800/95 p-1.5">
      {icons.map((I, i) => (
        <span key={i} className={cn("flex size-8 items-center justify-center rounded-full", i === active ? "bg-sun-200 text-ink-950" : "text-fg-3")}>
          <I className="size-3.5" />
        </span>
      ))}
    </div>
  );
}

export function DashboardPhone({ className }: { className?: string }) {
  return (
    <Phone className={className}>
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-sun-100 to-ember text-[10px] font-bold text-ink-950">MS</span>
        <div className="leading-tight">
          <p className="text-[9px] text-fg-3">Good morning</p>
          <p className="text-xs font-semibold">Mia</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-amber/15 px-1.5 py-0.5 text-[9px] font-bold text-amber">
          <Flame className="size-2.5" /> 5
        </span>
      </div>
      <p className="mt-3 font-display text-[17px] font-semibold leading-tight">
        Ready to make <span className="text-grad-sun">today count?</span>
      </p>
      <div className="mt-3 flex gap-1">
        {["All", "Quests", "Classes"].map((t, i) => (
          <span key={t} className={cn("rounded-full px-2.5 py-1 text-[9px] font-semibold", i === 0 ? "bg-sun-200 text-ink-950" : "bg-white/5 text-fg-2")}>
            {t}
          </span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="col-span-2 rounded-2xl bg-sun-200 p-3 text-ink-950">
          <p className="text-[9px] font-semibold opacity-70">Next class · Room 12</p>
          <p className="font-display text-sm font-semibold">Mathematics</p>
          <p className="mt-2 inline-block rounded-full bg-ink-950 px-2 py-0.5 text-[8px] font-bold text-sun-100">in 12 min</p>
        </div>
        <div className="rounded-2xl bg-iris-400 p-2.5 text-ink-950">
          <ListChecks className="size-3.5" />
          <p className="mt-3 text-[10px] font-semibold">Quiz</p>
          <p className="text-[8px] opacity-70">+30 XP</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-ink-800 p-2.5">
          <Layers className="size-3.5 text-sun-200" />
          <p className="mt-3 text-[10px] font-semibold">20 cards</p>
          <p className="text-[8px] text-fg-3">12/20</p>
        </div>
      </div>
      <div className="mt-2 rounded-2xl border border-white/10 bg-ink-800 p-2.5">
        <div className="flex justify-between text-[9px]">
          <span className="font-semibold">Level 6</span>
          <span className="text-fg-3">420 / 600 XP</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-white/10">
          <div className="h-full w-[70%] rounded-full bg-gradient-to-r from-sun-100 to-sun-300" />
        </div>
      </div>
      <BottomBar active={0} />
    </Phone>
  );
}

export function StudyPhone({ className }: { className?: string }) {
  return (
    <Phone className={className}>
      <p className="text-center text-xs font-semibold">AI Study</p>
      <div className="mt-3 overflow-hidden rounded-2xl bg-gradient-to-br from-sun-100 to-sun-300 p-3 text-ink-950">
        <p className="font-display text-sm font-semibold">Flashcards</p>
        <span className="mt-3 inline-block rounded-full bg-ink-950 px-2.5 py-1 text-[8px] font-semibold text-fg">Start review</span>
      </div>
      <p className="mt-3 text-[10px] font-semibold">Study tools</p>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {[
          [MessagesSquare, "Tutor"],
          [ScanText, "Homework"],
          [Sparkles, "Summary"],
        ].map(([I, l], i) => {
          const Icon = I as typeof MessagesSquare;
          return (
            <div key={i} className={cn("flex flex-col items-center rounded-2xl border p-2", i === 0 ? "border-iris-400/60 bg-iris-400/10" : "border-white/10 bg-ink-800")}>
              <span className="flex size-7 items-center justify-center rounded-xl bg-sun-200 text-ink-950">
                <Icon className="size-3.5" />
              </span>
              <span className="mt-1.5 text-[8px] font-semibold">{l as string}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 space-y-1.5">
        <p className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-sun-200 px-2.5 py-1.5 text-[9px] text-ink-950">Why do leaves look green?</p>
        <div className="w-[88%] rounded-2xl rounded-tl-md border border-white/10 bg-ink-800 px-2.5 py-2 text-[9px] text-fg-2">
          <span className="mb-1 inline-block rounded bg-mint/20 px-1 text-[7px] font-bold text-mint">From your lessons</span>
          <p>Chlorophyll absorbs red and blue light and reflects green light <span className="rounded bg-mint/20 px-0.5 text-[7px] font-bold text-mint">S1</span></p>
        </div>
      </div>
      <BottomBar active={2} />
    </Phone>
  );
}

export function RewardsPhone({ className }: { className?: string }) {
  return (
    <Phone className={className}>
      <div className="rounded-2xl bg-gradient-to-br from-iris-400 to-iris-600 p-3 text-ink-950">
        <p className="text-[9px] font-semibold opacity-70">2026</p>
        <p className="font-display text-sm font-semibold">November</p>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {Array.from({ length: 21 }, (_, i) => (
            <span key={i} className={cn("flex aspect-square items-center justify-center rounded-full text-[7px] font-semibold", i === 11 ? "bg-sun-200" : "bg-ink-950 text-fg")}>
              {i + 3}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[10px] font-semibold">Volunteering</p>
      <div className="mt-1.5 space-y-1.5">
        {[
          ["Recycling drive", "+40"],
          ["Library afternoon", "+35"],
        ].map(([t, c]) => (
          <div key={t} className="flex items-center justify-between rounded-xl border border-white/10 bg-ink-800 px-2.5 py-2 text-[9px]">
            <span className="font-semibold">{t}</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-amber">
              <Coins className="size-2.5" />
              {c}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 rounded-xl bg-amber p-2.5 text-ink-950">
        <p className="text-[8px] font-semibold opacity-70">Accredited course · 150 RON grant</p>
        <p className="font-display text-base font-bold">First Aid for Teens</p>
      </div>
      <BottomBar active={1} />
    </Phone>
  );
}
