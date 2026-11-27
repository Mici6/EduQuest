import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowRight, Bot, Coins, FileText, GraduationCap, HandHeart, ShieldCheck, Users } from "lucide-react";
import { BarsChart } from "@/components/charts/charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { Notice } from "@/components/ui/states";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { schoolOverview } from "@/lib/domain/admin";
import { fmtDate, fmtGrade } from "@/lib/utils/format";

export const metadata: Metadata = { title: "School overview" };

export default async function AdminOverview() {
  const actor = await requireActor(["admin"]);
  const db = getDb();
  const o = schoolOverview(db, actor);
  const school = db.get<{ name: string }>(`SELECT name FROM schools WHERE id = ?`, actor.schoolId)!;
  const seededAt = db.get<{ value: string }>(`SELECT value FROM meta WHERE key = 'seeded_at'`)?.value;
  const ageDays = seededAt ? Math.floor((new Date().getTime() - new Date(seededAt.replace(" ", "T") + "Z").getTime()) / 86400000) : 0;
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="School administration" title={school.name} description="Enrolment, engagement and academic activity across the school. Aggregates only — individual support records are restricted to support staff." />
      {ageDays >= 2 ? (
        <Notice tone="warn" title={`Demo data is ${ageDays} days old`}>
          Dates in the sample data no longer line up with today. Reset it from <Link href="/app/admin/settings">School settings</Link>.
        </Notice>
      ) : null}
      <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-3 @5xl:grid-cols-6">
        <StatCard label="Students" value={o.counts.student} icon={<GraduationCap />} accent="sun" />
        <StatCard label="Teachers" value={o.counts.teacher} icon={<Users />} accent="iris" />
        <StatCard label="Active this week" value={o.active7} hint="users with activity in 7 days" icon={<Activity />} accent="mint" />
        <StatCard label="Attendance (30 days)" value={`${o.attendance.rate ?? "—"}%`} accent="ember" />
        <StatCard label="Indexed lessons" value={o.documents} icon={<FileText />} />
        <StatCard label="AI requests today" value={o.aiToday} icon={<Bot />} />
      </div>
      <div className="grid gap-5 @4xl:grid-cols-12">
        <Card className="@4xl:col-span-8">
          <BarsChart
            title="Learning activity"
            description="Completed quizzes, flashcard reviews and homework submissions per day (last 14 days)"
            data={o.engagement.map((d) => ({ label: fmtDate(d.day), quizzes: d.quizzes, flashcards: d.flashcards, homework: d.homework }))}
            xKey="label"
            series={[
              { key: "quizzes", name: "Quizzes" },
              { key: "flashcards", name: "Flashcard reviews" },
              { key: "homework", name: "Homework" },
            ]}
            height={260}
          />
        </Card>
        <div className="space-y-5 @4xl:col-span-4">
          <Card>
            <CardHeader icon={<HandHeart className="size-5 text-mint" />} title="Community & credits" />
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-white/[0.04] p-3">
                <dt className="text-xs text-fg-3">Activities</dt>
                <dd className="font-display text-xl font-semibold">{o.volunteering.activities}</dd>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-3">
                <dt className="text-xs text-fg-3">Verified participations</dt>
                <dd className="font-display text-xl font-semibold">{o.volunteering.verified}</dd>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-3">
                <dt className="inline-flex items-center gap-1 text-xs text-fg-3">
                  <Coins className="size-3" /> Credits earned
                </dt>
                <dd className="font-display text-xl font-semibold">{o.credits.earned}</dd>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-3">
                <dt className="text-xs text-fg-3">Credits redeemed</dt>
                <dd className="font-display text-xl font-semibold">{o.credits.spent}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <CardHeader icon={<ShieldCheck className="size-5 text-iris-300" />} title="Student support (aggregate)" subtitle="Counts only. Identities are visible solely to authorised support staff." />
            <div className="flex flex-wrap gap-2">
              <Badge tone="ember">{o.support.pending} awaiting human review</Badge>
              <Badge tone="iris">{o.support.plans} active support plans</Badge>
              <Badge>{o.support.dismissed} reviewed & dismissed</Badge>
            </div>
          </Card>
        </div>
      </div>
      <Card>
        <CardHeader title="Classes" action={<Link href="/app/admin/classes" className="inline-flex items-center gap-1 text-xs font-semibold text-fg-2 hover:text-fg">Manage <ArrowRight className="size-3.5" /></Link>} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs text-fg-3">
              <tr className="border-b border-line">
                <th scope="col" className="py-2.5 font-semibold">Class</th>
                <th scope="col" className="py-2.5 font-semibold">Homeroom teacher</th>
                <th scope="col" className="py-2.5 text-right font-semibold">Students</th>
                <th scope="col" className="py-2.5 text-right font-semibold">Average grade</th>
                <th scope="col" className="py-2.5 text-right font-semibold">Attendance (30d)</th>
              </tr>
            </thead>
            <tbody>
              {o.classes.map((c) => (
                <tr key={c.id} className="border-b border-line/50 last:border-0">
                  <td className="py-3 font-semibold">{c.name}</td>
                  <td className="py-3 text-fg-2">{c.homeroom ?? "—"}</td>
                  <td className="py-3 text-right tabular-nums">{c.students}</td>
                  <td className="py-3 text-right tabular-nums">{fmtGrade(c.average)}</td>
                  <td className="py-3 text-right tabular-nums">{c.attendance ?? "—"}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
