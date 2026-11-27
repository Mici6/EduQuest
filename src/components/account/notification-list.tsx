"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { BellRing, CheckCheck, Gift, GraduationCap, HandHeart, Megaphone, Settings2, Sparkles, Trophy } from "lucide-react";
import { markAllReadAction, markReadAction } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { cn, relativeTime } from "@/lib/utils/format";

type N = { id: string; category: string; title: string; body: string; href: string | null; read_at: string | null; created_at: string };

const ICON: Record<string, typeof BellRing> = {
  academic: GraduationCap,
  announcement: Megaphone,
  gamification: Trophy,
  rewards: Gift,
  volunteering: HandHeart,
  study: Sparkles,
  system: Settings2,
};

const TONE: Record<string, string> = {
  academic: "bg-sky/15 text-sky",
  announcement: "bg-iris-400/15 text-iris-200",
  gamification: "bg-sun-300/15 text-sun-200",
  rewards: "bg-ember/15 text-amber",
  volunteering: "bg-mint/15 text-mint",
  study: "bg-iris-400/15 text-iris-200",
  system: "bg-white/[0.06] text-fg-2",
};

export function NotificationList({ items, unread }: { items: N[]; unread: number }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const open = (n: N) =>
    start(async () => {
      if (!n.read_at) await markReadAction(n.id, true);
      if (n.href) router.push(n.href);
    });
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-fg-2">{unread ? `${unread} unread` : "You're all caught up"}</p>
        <Button
          variant="secondary"
          size="sm"
          disabled={!unread || pending}
          onClick={() =>
            start(async () => {
              const res = await markAllReadAction();
              if (!res.ok) toast({ tone: "error", title: "Couldn't update", body: res.error });
            })
          }
        >
          <CheckCheck /> Mark all read
        </Button>
      </div>
      {items.length ? (
        <ul className="space-y-2">
          {items.map((n) => {
            const Icon = ICON[n.category] ?? BellRing;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  className={cn("flex w-full items-start gap-3 rounded-[20px] border p-4 text-left transition-colors", n.read_at ? "border-line/60 bg-ink-900/30" : "border-line bg-ink-800 hover:border-line-strong")}
                >
                  <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-2xl", TONE[n.category])}>
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", n.read_at ? "text-fg-2" : "font-semibold text-fg")}>{n.title}</span>
                    <span className="mt-0.5 block text-xs text-fg-3">{n.body}</span>
                    <span className="mt-1.5 block text-[11px] text-fg-3">{relativeTime(n.created_at)}</span>
                  </span>
                  {!n.read_at ? <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-ember" aria-label="Unread" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<BellRing />} title="No notifications">We only notify you about things that matter — never spam.</EmptyState>
      )}
    </div>
  );
}
