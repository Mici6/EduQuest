import { AppShell } from "@/components/shell/app-shell";
import { requireActor } from "@/lib/auth/current";
import { publicConfig } from "@/lib/config/env";
import { schoolSettings } from "@/lib/domain/admin";
import { getDb } from "@/lib/db";
import { companionContext } from "@/lib/domain/companion";
import { creditBalance } from "@/lib/domain/credits";
import { levelInfo } from "@/lib/domain/gamification";
import { getUserSettings, unreadCount } from "@/lib/domain/notifications";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const actor = await requireActor();
  const db = getDb();
  const row = db.get<{ avatar_hue: number; title: string | null; school_name: string }>(
    `SELECT u.avatar_hue, u.title, s.name school_name FROM users u JOIN schools s ON s.id = u.school_id WHERE u.id = ?`,
    actor.id,
  )!;
  const cfg = publicConfig();
  const level = actor.role === "student" ? levelInfo(db, actor.id) : null;
  // Irbis is only for students, and only when the school allows AI for them.
  const ctx = actor.role === "student" && cfg.aiMode !== "unavailable" && schoolSettings(db, actor.schoolId).aiEnabledForStudents ? companionContext(db, actor) : null;
  return (
    <AppShell
      user={{
        id: actor.id,
        name: actor.displayName,
        role: actor.role,
        hue: row.avatar_hue,
        title: row.title,
        schoolName: row.school_name,
        frame: getUserSettings(db, actor.id).profileFrame ?? "none",
        level: level ? { level: level.level, title: level.title, progress: level.progress } : null,
        credits: actor.role === "student" ? creditBalance(db, actor.id) : null,
      }}
      unread={unreadCount(db, actor)}
      demo={cfg.mode === "demo"}
      aiMode={cfg.aiMode}
      companion={ctx ? { firstName: ctx.firstName, streakDays: ctx.streakDays, dueCount: ctx.homework.length, overdueCount: ctx.homework.filter((h) => h.overdue).length } : null}
    >
      {children}
    </AppShell>
  );
}
