"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Bell, Coins, Ellipsis, FlaskConical, LoaderCircle, LogOut, Repeat, Settings } from "lucide-react";
import { signInDemo, signOut } from "@/actions/auth";
import { CompanionDock, type CompanionSummary } from "@/components/companion/companion-dock";
import { Avatar } from "@/components/ui/avatar";
import { Dialog } from "@/components/ui/dialog";
import { Menu, MenuItem } from "@/components/ui/menu";
import { ProgressBar } from "@/components/ui/progress";
import type { Role } from "@/lib/auth/types";
import { ROLE_LABEL } from "@/lib/auth/types";
import { cn } from "@/lib/utils/format";
import { Logo, LogoMark } from "./logo";
import { NAV, isActive, type NavItem } from "./nav-config";

export type ShellUser = {
  id: string;
  name: string;
  role: Role;
  hue: number;
  title: string | null;
  schoolName: string;
  frame: string;
  level?: { level: number; title: string; progress: number } | null;
  credits?: number | null;
};

const PERSONAS: { id: string; name: string; role: Role }[] = [
  { id: "usr_alex", name: "Alex Rivera", role: "student" },
  { id: "usr_novak", name: "Elena Novak", role: "teacher" },
  { id: "usr_ionescu", name: "Mara Ionescu", role: "admin" },
  { id: "usr_adeyemi", name: "Sam Adeyemi", role: "support" },
];

export const FRAME_RING: Record<string, string> = {
  none: "",
  sun: "ring-2 ring-sun-300 ring-offset-2 ring-offset-ink-950",
  ember: "ring-2 ring-ember ring-offset-2 ring-offset-ink-950",
  iris: "ring-2 ring-iris-400 ring-offset-2 ring-offset-ink-950",
  aurora: "ring-[3px] ring-sun-200 ring-offset-2 ring-offset-iris-600",
};

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = isActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-11 items-center gap-3 rounded-full px-4 text-sm font-medium transition-colors",
        active ? "bg-sun-200 text-ink-950 shadow-[0_8px_24px_-12px_rgb(255_211_77/0.8)]" : "text-fg-2 hover:bg-white/[0.05] hover:text-fg",
      )}
    >
      <Icon className={cn("size-[18px] shrink-0", active ? "text-ink-950" : "text-fg-3 group-hover:text-fg-2")} aria-hidden />
      {item.label}
    </Link>
  );
}

function RoleSwitcher({ current, compact }: { current: string; compact?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Menu
      label="Switch demo role"
      align={compact ? "end" : "start"}
      trigger={
        <span className={cn("inline-flex items-center gap-2 rounded-full border border-dashed border-iris-400/40 bg-iris-400/[0.08] text-xs font-semibold text-iris-200", compact ? "h-9 px-3" : "h-9 w-full justify-center px-3")}>
          {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Repeat className="size-3.5" />}
          {compact ? "Role" : "Switch demo role"}
        </span>
      }
    >
      {(close) => (
        <>
          <p className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-fg-3">Demo accounts</p>
          {PERSONAS.map((p) => (
            <MenuItem
              key={p.id}
              disabled={p.id === current || pending}
              onClick={() => {
                close();
                start(() => signInDemo(p.id));
              }}
            >
              <span className="flex w-full items-center justify-between gap-3">
                <span>{p.name}</span>
                <span className="text-[11px] text-fg-3">{ROLE_LABEL[p.role]}</span>
              </span>
            </MenuItem>
          ))}
        </>
      )}
    </Menu>
  );
}

export function AppShell({ user, unread, demo, aiMode, companion, children }: { user: ShellUser; unread: number; demo: boolean; aiMode: string; companion?: CompanionSummary | null; children: ReactNode }) {
  const pathname = usePathname();
  const nav = NAV[user.role];
  const [moreOpen, setMoreOpen] = useState(false);
  const [signingOut, startSignOut] = useTransition();

  return (
    <div className="min-h-dvh lg:pl-[280px]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col border-r border-line/70 bg-ink-950/70 px-4 pb-4 pt-6 backdrop-blur-xl lg:flex" aria-label="Main navigation">
        <Link href="/app" className="mb-6 px-3" aria-label="EduQuest home">
          <Logo gid="eq-g-side" />
        </Link>
        {user.level ? (
          <div className="surface mb-5 rounded-[22px] p-4">
            <div className="flex items-center gap-3">
              <Avatar name={user.name} hue={user.hue} size={40} className={FRAME_RING[user.frame]} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="text-xs text-fg-3">
                  Level {user.level.level} · {user.level.title}
                </p>
              </div>
            </div>
            <ProgressBar value={user.level.progress} className="mt-3" size="sm" label="XP progress to next level" />
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-fg-2">
                <Coins className="size-3.5 text-amber" aria-hidden /> {user.credits ?? 0} credits
              </span>
              <Link href="/app/progress" className="font-semibold text-sun-200 hover:underline">
                View progress
              </Link>
            </div>
          </div>
        ) : null}
        <nav className="scrollbar-none -mx-1 flex-1 space-y-1 overflow-y-auto px-1" aria-label="Sections">
          {nav.primary.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
          <div className="my-3 h-px bg-line/70" />
          {nav.secondary.map((item) => (
            <div key={item.href} className="relative">
              <NavLink item={item} pathname={pathname} />
              {item.href === "/app/notifications" && unread > 0 ? (
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-ember px-1.5 text-[10px] font-bold text-ink-950">{unread}</span>
              ) : null}
            </div>
          ))}
        </nav>
        <div className="mt-4 space-y-3 border-t border-line/70 pt-4">
          {demo ? <RoleSwitcher current={user.id} /> : null}
          <div className="flex items-center gap-3 px-1">
            {user.level ? null : <Avatar name={user.name} hue={user.hue} size={36} />}
            <div className="min-w-0 flex-1">
              {user.level ? null : <p className="truncate text-sm font-semibold">{user.name}</p>}
              <p className="truncate text-xs text-fg-3">
                {ROLE_LABEL[user.role]} · {user.schoolName}
              </p>
            </div>
            <button
              type="button"
              onClick={() => startSignOut(() => signOut())}
              className="inline-flex size-9 items-center justify-center rounded-full text-fg-3 hover:bg-white/[0.06] hover:text-fg"
              aria-label="Sign out"
            >
              {signingOut ? <LoaderCircle className="size-4 animate-spin" /> : <LogOut className="size-4" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line/50 bg-ink-950/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/app" aria-label="EduQuest home" className="flex items-center gap-2">
          <LogoMark size={30} gid="eq-g-top" />
          <span className="font-display text-base font-bold">
            Edu<span className="text-sun-300">Quest</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {demo ? <RoleSwitcher current={user.id} compact /> : null}
          <Link href="/app/notifications" className="relative inline-flex size-10 items-center justify-center rounded-full border border-line bg-ink-800 text-fg-2" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
            <Bell className="size-[18px]" />
            {unread > 0 ? <span className="absolute right-2 top-2 size-2 rounded-full bg-ember ring-2 ring-ink-800" /> : null}
          </Link>
          <Menu label="Account menu" trigger={<Avatar name={user.name} hue={user.hue} size={38} className={FRAME_RING[user.frame]} />}>
            {(close) => (
              <>
                <div className="px-3 pb-2 pt-1.5">
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-xs text-fg-3">{ROLE_LABEL[user.role]}</p>
                </div>
                <MenuItem icon={<Settings />} render={<Link href="/app/settings" />} onClick={close}>
                  Settings
                </MenuItem>
                <MenuItem
                  icon={<LogOut />}
                  onClick={() => {
                    close();
                    startSignOut(() => signOut());
                  }}
                >
                  Sign out
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[1320px] px-4 pb-32 pt-5 sm:px-6 lg:px-10 lg:pb-14 lg:pt-8">
        {demo ? (
          <div className="mb-5 flex flex-wrap items-center gap-2 text-[11px] text-fg-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line-strong px-2.5 py-1">
              <span className="size-1.5 rounded-full bg-sun-300" aria-hidden /> Demo mode · sample data only
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line-strong px-2.5 py-1">
              <FlaskConical className="size-3" aria-hidden />
              AI: {aiMode === "cloud" ? "cloud (live)" : aiMode === "browser" ? "on-device (free)" : aiMode === "simulated" ? "simulated, no model" : "not configured"}
            </span>
          </div>
        ) : null}
        <div className="@container">{children}</div>
      </main>

      {/* The tutor page already is Irbis; no second Irbis floating on top of it. */}
      {companion && !pathname.startsWith("/app/study/chat") ? <CompanionDock summary={companion} /> : null}

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 lg:hidden" aria-label="Primary">
        <div className="mx-auto flex max-w-md items-center justify-between gap-1 rounded-[26px] border border-line bg-ink-800/90 p-1.5 shadow-[0_20px_50px_-15px_rgb(0_0_0/0.8)] backdrop-blur-xl">
          {nav.mobile.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[10px] font-semibold transition-all",
                  active ? "bg-sun-200 text-ink-950 shadow-[0_8px_20px_-6px_rgb(255_211_77/0.7)]" : "text-fg-2 hover:bg-white/[0.06]",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            className="flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[10px] font-semibold text-fg-2 hover:bg-white/[0.06]"
          >
            <Ellipsis className="size-5" aria-hidden />
            More
          </button>
        </div>
      </nav>
      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="All sections" description={`${ROLE_LABEL[user.role]} · ${user.schoolName}`}>
        <div className="grid grid-cols-2 gap-2">
          {[...nav.primary, ...nav.secondary].map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={cn("flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-medium", active ? "border-sun-300/50 bg-sun-300/10 text-sun-100" : "border-line bg-ink-800 text-fg-2")}
              >
                <Icon className="size-[18px]" aria-hidden />
                {item.label}
                {item.href === "/app/notifications" && unread > 0 ? <span className="ml-auto rounded-full bg-ember px-1.5 text-[10px] font-bold text-ink-950">{unread}</span> : null}
              </Link>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => startSignOut(() => signOut())}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-line py-3 text-sm font-semibold text-fg-2"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </Dialog>
    </div>
  );
}

