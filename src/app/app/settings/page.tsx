import type { Metadata } from "next";
import Link from "next/link";
import { Bot, Database, Lock, UserRound } from "lucide-react";
import { NotificationPrefs, PrivacyPrefs } from "@/components/account/settings-form";
import { ResetDemoButton } from "@/components/auth/reset-demo-button";
import { AiStatusNotice } from "@/components/study/ai-status";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { ROLE_LABEL } from "@/lib/auth/types";
import { config, publicConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { NOTIFICATION_CATEGORIES, getUserSettings } from "@/lib/domain/notifications";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const actor = await requireActor();
  const db = getDb();
  const cfg = publicConfig();
  const user = db.get<{ email: string; avatar_hue: number; title: string | null; school: string }>(
    `SELECT u.email, u.avatar_hue, u.title, s.name school FROM users u JOIN schools s ON s.id = u.school_id WHERE u.id = ?`,
    actor.id,
  )!;
  const s = getUserSettings(db, actor.id);
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Settings" description="Your profile, notifications and privacy choices." />
      <Card>
        <CardHeader icon={<UserRound className="size-5 text-sun-300" />} title="Profile" subtitle="Managed by your school. Contact the school office to change these details." />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={actor.displayName} hue={user.avatar_hue} size={64} />
          <dl className="grid flex-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-fg-3">Name</dt>
              <dd className="font-medium">{actor.displayName}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-3">Role</dt>
              <dd className="font-medium">
                {ROLE_LABEL[actor.role]}
                {user.title ? ` · ${user.title}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-fg-3">Email</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-3">School</dt>
              <dd className="font-medium">{user.school}</dd>
            </div>
          </dl>
        </div>
      </Card>
      <div className="grid gap-5 @4xl:grid-cols-2">
        <Card>
          <CardHeader title="Notifications" subtitle="Low-value notifications are also capped per day to avoid spam." />
          <NotificationPrefs categories={NOTIFICATION_CATEGORIES.map((c) => ({ id: c.id, label: c.label, description: c.description }))} prefs={s.notifications} />
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader icon={<Lock className="size-5 text-iris-300" />} title="Privacy & preferences" />
            <PrivacyPrefs showOnLeaderboard={!!s.showOnLeaderboard} goal={s.dailyStudyGoalMinutes ?? 30} reduceMotion={!!s.reduceMotion} isStudent={actor.role === "student"} />
          </Card>
          <Card>
            <CardHeader icon={<Database className="size-5 text-mint" />} title="Your data" />
            <ul className="space-y-2 text-sm text-fg-2">
              <li>• We store only what's needed to run your school record and study tools.</li>
              <li>• {actor.role === "student" ? "Other students can never see your grades, attendance or activity." : "Access to student records is limited to your role and scope, and sensitive access is audit-logged."}</li>
              <li>• Student-support records are visible only to authorised support staff, never to students or classmates.</li>
              <li>• AI requests send only the question and relevant lesson excerpts to the configured provider — no grades or personal records.</li>
            </ul>
          </Card>
        </div>
      </div>
      <Card>
        <CardHeader icon={<Bot className="size-5 text-iris-300" />} title="AI configuration" subtitle="Read-only. Configured by the deployment's environment variables." />
        <AiStatusNotice mode={cfg.aiMode} model={cfg.aiModel} />
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Badge tone={cfg.ocrEnabled ? "mint" : "neutral"}>OCR {cfg.ocrEnabled ? "enabled" : "unavailable"}</Badge>
          <Badge>Retrieval: lexical BM25</Badge>
          <Badge>Embeddings: not configured</Badge>
        </div>
      </Card>
      {cfg.mode === "demo" ? (
        <Card tone="outline">
          <CardHeader title="Demo environment" subtitle="All people and records here are fictional sample data." action={config.demoResetAllowed ? <ResetDemoButton variant="secondary" /> : undefined} />
          <p className="text-sm text-fg-2">
            Resetting regenerates the sample school with current dates. See the <Link href="/" className="text-sun-200 hover:underline">product overview</Link> for what EduQuest offers.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
