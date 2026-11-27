import Link from "next/link";
import { Award, BadgeCheck, CalendarDays, Clock, FileSignature, FolderKanban, HandHeart, Medal, Stamp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, IconChip } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatCard } from "@/components/ui/stat";
import type { Passport } from "@/lib/domain/passport";
import { fmtDateLong as fmtDate } from "@/lib/utils/format";
import { CredentialActions, ProjectControls } from "./passport-controls";

const KIND_LABEL = { passport: "Skills Passport", course_certificate: "Course certificate", recommendation: "Recommendation letter" } as const;
const TIER_TONE = { bronze: "ember", silver: "neutral", gold: "sun" } as const;

/** The passport body, shared by the student's own page and the teacher's view of a student. */
export function PassportSections({ data, mode }: { data: Passport; mode: "student" | "teacher" | "admin" }) {
  const verifiedProjects = data.projects.filter((p) => p.verified_at).length;
  const documents = data.credentials.filter((c) => c.kind !== "course_certificate");
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Verified volunteering" value={`${data.volunteeringHours} h`} accent="mint" icon={<HandHeart />} />
        <StatCard label="Badges" value={data.badges.length} accent="sun" icon={<Medal />} />
        <StatCard label="Certified courses" value={data.courses.length} accent="iris" icon={<Award />} />
        <StatCard label="Projects (verified)" value={`${data.projects.length} (${verifiedProjects})`} accent="ember" icon={<FolderKanban />} />
      </div>

      <div className="grid gap-5 @4xl:grid-cols-2">
        <Card>
          <CardHeader title="Volunteering" subtitle="Only activities a teacher verified." icon={<IconChip tone="mint"><HandHeart /></IconChip>} />
          {data.volunteering.length ? (
            <ul className="divide-y divide-line">
              {data.volunteering.map((v) => (
                <li key={v.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-medium">{v.title}</p>
                    <p className="mt-0.5 text-xs text-fg-3">
                      {v.category} · {fmtDate(v.starts_at)} · verified by {v.verifier ?? "a teacher"}
                    </p>
                  </div>
                  <Badge tone="mint" icon={<Clock />}>
                    {v.hours} h
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<HandHeart />} title="No verified volunteering yet" />
          )}
        </Card>

        <Card>
          <CardHeader title="Certified mini-courses" icon={<IconChip tone="iris"><Award /></IconChip>} action={mode === "student" ? <Link href="/app/courses" className="text-sm font-semibold text-sun-200 hover:underline">Browse</Link> : null} />
          {data.courses.length ? (
            <ul className="divide-y divide-line">
              {data.courses.map((c) => (
                <li key={c.course_id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-medium">{c.title}</p>
                    <p className="mt-0.5 text-xs text-fg-3">
                      Completed {fmtDate(c.completed_at)} · score {c.best_score}%
                    </p>
                  </div>
                  {c.certificate_id ? (
                    <Link href={`/verify/${c.certificate_id}`} target="_blank" className="text-sm font-semibold text-sun-200 hover:underline">
                      Certificate
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Award />} title="No certificates yet">
              {mode === "student" ? "Unlock a mini-course with credits and pass its quiz." : null}
            </EmptyState>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Badges" icon={<IconChip tone="sun"><Medal /></IconChip>} />
        {data.badges.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.badges.map((b) => (
              <div key={b.title} className="rounded-2xl border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{b.title}</p>
                  <Badge tone={TIER_TONE[b.tier as keyof typeof TIER_TONE] ?? "neutral"}>{b.tier}</Badge>
                </div>
                <p className="mt-1 text-xs text-fg-3">{b.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Medal />} title="No badges yet" />
        )}
      </Card>

      <Card>
        <CardHeader
          title="Projects"
          subtitle={mode === "teacher" ? "Verify projects you can vouch for." : "Self-reported until a teacher verifies them."}
          icon={<IconChip tone="ember"><FolderKanban /></IconChip>}
        />
        {data.projects.length ? (
          <ul className="divide-y divide-line">
            {data.projects.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{p.title}</p>
                    {p.verified_at ? (
                      <Badge tone="mint" icon={<BadgeCheck />}>
                        Verified by {p.verifier}
                      </Badge>
                    ) : (
                      <Badge>Self-reported</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-fg-2">{p.description}</p>
                  {p.link ? (
                    <a href={p.link} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-block break-all text-xs text-sun-200 hover:underline">
                      {p.link}
                    </a>
                  ) : null}
                </div>
                {mode !== "admin" ? <ProjectControls id={p.id} mode={mode} verified={!!p.verified_at} /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<FolderKanban />} title="No projects yet" />
        )}
      </Card>

      <Card>
        <CardHeader title="Sealed documents" subtitle="Passports and recommendation letters, each with a public verification link." icon={<IconChip tone="iris"><Stamp /></IconChip>} />
        {documents.length ? (
          <ul className="divide-y divide-line">
            {documents.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {c.kind === "recommendation" ? <FileSignature className="size-4 text-iris-200" aria-hidden /> : <Stamp className="size-4 text-sun-200" aria-hidden />}
                    <p className="font-medium">{KIND_LABEL[c.kind]}</p>
                    {c.revoked_at ? <Badge tone="rose">Revoked</Badge> : <Badge tone="mint">Valid</Badge>}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-fg-3">
                    <CalendarDays className="size-3" aria-hidden /> Issued {fmtDate(c.issued_at)}
                    {c.issuer_name ? ` · signed by ${c.issuer_name}` : ""}
                  </p>
                </div>
                <CredentialActions id={c.id} revoked={!!c.revoked_at} canRevoke={(mode === "student" && c.kind === "passport") || (mode === "teacher" && c.kind === "recommendation")} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Stamp />} title="No sealed documents yet">
            {mode === "student" ? "Issue your passport to get a link you can attach to applications." : null}
          </EmptyState>
        )}
      </Card>
    </div>
  );
}
