import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, GraduationCap, HeartHandshake, ShieldCheck } from "lucide-react";
import { PersonaButton } from "@/components/auth/persona-button";
import { ResetDemoButton } from "@/components/auth/reset-demo-button";
import { Logo } from "@/components/shell/logo";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/states";
import { getActor, homeFor } from "@/lib/auth/current";
import { ROLE_LABEL, type Role } from "@/lib/auth/types";
import { config } from "@/lib/config/env";
import { getDb } from "@/lib/db";

export const metadata: Metadata = { title: "Sign in" };

const PRIMARY: { id: string; role: Role; blurb: string; icon: typeof GraduationCap }[] = [
  { id: "usr_alex", role: "student", blurb: "Dashboard, quests, AI study tools, volunteering and AI courses.", icon: GraduationCap },
  { id: "usr_novak", role: "teacher", blurb: "Classes, grade entry, attendance, assignments and the AI Studio.", icon: BookOpen },
  { id: "usr_ionescu", role: "admin", blurb: "School overview, people, classes, grants, settings and audit log.", icon: ShieldCheck },
  { id: "usr_adeyemi", role: "support", blurb: "Privacy-restricted review queue, support plans and follow-up.", icon: HeartHandshake },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const actor = await getActor();
  const db = getDb();
  const users = db.all<{ id: string; display_name: string; role: Role; avatar_hue: number; title: string | null; class_name: string | null }>(
    `SELECT u.id, u.display_name, u.role, u.avatar_hue, u.title,
            (SELECT c.name FROM class_memberships cm JOIN classes c ON c.id = cm.class_id WHERE cm.user_id = u.id LIMIT 1) class_name
     FROM users u WHERE u.is_demo = 1 AND u.active = 1 ORDER BY u.role, u.display_name`,
  );
  const byId = new Map(users.map((u) => [u.id, u]));
  const others = users.filter((u) => !PRIMARY.some((p) => p.id === u.id));
  const demo = config.mode === "demo";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-line/60 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="grid-dots absolute inset-0 opacity-60" aria-hidden />
        <div className="absolute -left-24 top-1/3 size-[420px] rounded-full bg-sun-300/10 blur-3xl" aria-hidden />
        <div className="absolute -right-24 bottom-10 size-[380px] rounded-full bg-iris-600/20 blur-3xl" aria-hidden />
        <Link href="/" className="relative">
          <Logo size={34} gid="eq-g-login-a" />
        </Link>
        <div className="relative max-w-lg">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-sun-300">Learn. Level up. Make a difference.</p>
          <h1 className="font-display text-5xl font-semibold leading-[1.05]">
            Every lesson, quest and good deed <span className="text-grad-sun">counts.</span>
          </h1>
          <p className="mt-5 text-base text-fg-2">
            EduQuest brings the school catalog, AI study tools, gamified progress, volunteering and accredited courses into one calm, focused place.
          </p>
        </div>
        <ul className="relative grid max-w-lg grid-cols-2 gap-3 text-sm text-fg-2">
          {["XP for learning, never for screen time", "Credits only from verified good deeds", "AI grounded in your teachers' lessons", "Support reviewed by people, not algorithms"].map((t) => (
            <li key={t} className="surface rounded-2xl px-4 py-3">
              {t}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col px-4 py-8 sm:px-10 lg:justify-center lg:px-14">
        <div className="mx-auto w-full max-w-xl">
          <Link href="/" className="mb-8 inline-block lg:hidden">
            <Logo gid="eq-g-login-b" />
          </Link>
          {actor ? (
            <Notice tone="info" title={`You're signed in as ${actor.displayName}`} className="mb-6">
              <Link href={homeFor(actor.role)}>Continue to your dashboard</Link>
            </Notice>
          ) : null}
          {sp.reset ? (
            <Notice tone="success" title="Demo data was reset" className="mb-6">
              Fresh sample data with current dates has been generated.
            </Notice>
          ) : null}
          <h2 className="font-display text-3xl font-semibold">Sign in</h2>
          {demo ? (
            <p className="mt-2 text-sm text-fg-2">
              This is a <strong className="text-fg">demo environment</strong> with fictional people and sample data. Choose an account to explore EduQuest — no password needed.
            </p>
          ) : (
            <p className="mt-2 text-sm text-fg-2">Production sign-in is handled by your school's identity provider.</p>
          )}

          {demo ? (
            <>
              <div className="mt-6 grid gap-3">
                {PRIMARY.map((p) => {
                  const u = byId.get(p.id);
                  if (!u) return null;
                  return (
                    <PersonaButton key={p.id} userId={p.id}>
                      <span className="flex items-center gap-3.5">
                        <Avatar name={u.display_name} hue={u.avatar_hue} size={46} />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{u.display_name}</span>
                            <Badge tone={p.role === "student" ? "sun" : p.role === "teacher" ? "iris" : p.role === "admin" ? "sky" : "mint"}>{ROLE_LABEL[p.role]}</Badge>
                          </span>
                          <span className="mt-1 block text-xs text-fg-3">{p.blurb}</span>
                        </span>
                      </span>
                    </PersonaButton>
                  );
                })}
              </div>

              <details className="group mt-5 rounded-[22px] border border-line bg-ink-900/60">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-fg-2 hover:text-fg">
                  More demo accounts ({others.length})
                  <span className="text-xs text-fg-3 group-open:hidden">Show</span>
                  <span className="hidden text-xs text-fg-3 group-open:inline">Hide</span>
                </summary>
                <div className="max-h-80 overflow-y-auto border-t border-line p-2">
                  {others.map((u) => (
                    <PersonaButton key={u.id} userId={u.id} compact>
                      <span className="flex items-center gap-3">
                        <Avatar name={u.display_name} hue={u.avatar_hue} size={32} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{u.display_name}</span>
                          <span className="block text-xs text-fg-3">
                            {ROLE_LABEL[u.role]}
                            {u.class_name ? ` · ${u.class_name}` : u.title ? ` · ${u.title}` : ""}
                          </span>
                        </span>
                      </span>
                    </PersonaButton>
                  ))}
                </div>
              </details>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-xs text-fg-3">
                <span>Production deployments use Supabase Auth or school SSO instead of this picker.</span>
                {config.demoResetAllowed ? <ResetDemoButton /> : null}
              </div>
            </>
          ) : (
            <div className="mt-6">
              <Notice tone="warn" title="Identity provider not connected">
                Configure Supabase Auth (see the deployment guide) to enable production sign-in.
              </Notice>
              <ButtonLink href="/" variant="secondary" className="mt-4">
                Back to home
              </ButtonLink>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
