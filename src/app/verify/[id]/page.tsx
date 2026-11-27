import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { BadgeCheck, CircleAlert, ShieldAlert } from "lucide-react";
import { getDb } from "@/lib/db";
import { verifyCredential, type VerifiedCredential } from "@/lib/domain/credentials";
import { fmtDateLong as fmtDate } from "@/lib/utils/format";
import { PrintButton } from "./print-button";

// Personal documents: shared by link on purpose, but never indexed.
export const metadata: Metadata = { title: "Verify document", robots: { index: false, follow: false } };

type P = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const arr = (v: unknown) => (Array.isArray(v) ? (v as P[]) : []);

export default async function VerifyPage({ params }: PageProps<"/verify/[id]">) {
  const { id } = await params;
  const c = verifyCredential(getDb(), id);
  if (!c) notFound();
  return (
    <main id="main" className="min-h-dvh bg-ink-950 px-4 py-8 print:bg-white print:p-0 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <StatusBanner c={c} />
        <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
          <Link href="/" className="text-sm text-fg-3 hover:text-fg">
            EduQuest document verification
          </Link>
          <PrintButton />
        </div>
        <article className="relative rounded-3xl bg-[#fbf8f1] px-6 py-8 text-[#1d1a14] shadow-2xl print:rounded-none print:shadow-none sm:px-12 sm:py-12">
          <header className="flex items-start justify-between gap-6 border-b border-[#1d1a14]/15 pb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1d1a14]/60">{c.schoolCity ? `${c.schoolName} · ${c.schoolCity}` : c.schoolName}</p>
              <h1 className="mt-2 font-display text-2xl font-semibold leading-tight sm:text-3xl">{heading(c)}</h1>
            </div>
            <Seal school={c.schoolName} valid={c.status === "valid"} />
          </header>
          <div className="py-6 text-[15px] leading-relaxed">{c.kind === "passport" ? <PassportBody p={c.payload} /> : c.kind === "course_certificate" ? <CertificateBody p={c.payload} /> : <LetterBody p={c.payload} />}</div>
          <footer className="border-t border-[#1d1a14]/15 pt-5 text-xs text-[#1d1a14]/65">
            <p>
              Issued {fmtDate(c.issuedAt)} through EduQuest on behalf of {c.schoolName}
              {c.issuerName ? `, signed by ${c.issuerName}${c.issuerTitle ? ` (${c.issuerTitle})` : ""}` : ""}.
            </p>
            <p className="mt-1 break-all">
              Verification ID: <span className="font-mono">{c.id}</span>. Check authenticity at the address of this page.
            </p>
          </footer>
        </article>
      </div>
    </main>
  );
}

function heading(c: VerifiedCredential) {
  if (c.kind === "passport") return "Skills Passport";
  if (c.kind === "course_certificate") return "Certificate of Completion";
  return "Letter of Recommendation";
}

function StatusBanner({ c }: { c: VerifiedCredential }) {
  const s = {
    valid: { cls: "border-mint/40 bg-mint/10 text-mint", icon: <BadgeCheck />, title: "Genuine document", text: `Issued by ${c.schoolName} and unchanged since it was sealed.` },
    revoked: { cls: "border-rose/40 bg-rose/10 text-rose", icon: <CircleAlert />, title: "Revoked", text: `This document was withdrawn on ${fmtDate(c.revokedAt!)} and should not be relied on.` },
    tampered: { cls: "border-rose/40 bg-rose/10 text-rose", icon: <ShieldAlert />, title: "Not valid", text: "This document's contents don't match the school's seal. It may have been altered." },
  }[c.status];
  return (
    <div className={`mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3 print:border-[#1d1a14]/30 print:text-[#1d1a14] ${s.cls} [&_svg]:size-5`} role="status">
      <span className="mt-0.5 shrink-0">{s.icon}</span>
      <div>
        <p className="font-semibold">{s.title}</p>
        <p className="text-sm opacity-90">{s.text}</p>
      </div>
    </div>
  );
}

function Seal({ school, valid }: { school: string; valid: boolean }) {
  const text = `${school.toUpperCase()} · OFFICIAL SEAL · `;
  return (
    <svg viewBox="0 0 120 120" className={`size-24 shrink-0 sm:size-28 ${valid ? "text-[#8a1c1c]" : "text-[#1d1a14]/30"}`} role="img" aria-label={`${school} seal`}>
      <defs>
        <path id="seal-circle" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
      </defs>
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="60" cy="60" r="35" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text fill="currentColor" fontSize="8.5" fontWeight="700" letterSpacing="1.2">
        <textPath href="#seal-circle" textLength="270">
          {text.length > 46 ? text.slice(0, 46) : text}
        </textPath>
      </text>
      <path d="M60 40 l5.5 11.5 12.5 1.8 -9 8.8 2.1 12.4 -11.1-5.9 -11.1 5.9 2.1-12.4 -9-8.8 12.5-1.8z" fill="currentColor" />
    </svg>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#1d1a14]/60">{title}</h2>
      {children}
    </section>
  );
}

function PassportBody({ p }: { p: P }) {
  const volunteering = arr(p.volunteering);
  const badges = arr(p.badges);
  const courses = arr(p.courses);
  const projects = arr(p.projects);
  const letters = arr(p.recommendations);
  return (
    <>
      <p className="text-lg">
        <strong>{str(p.studentName)}</strong>
        {p.className ? `, ${str(p.className)}` : ""}. Student at {str(p.schoolName)} since {fmtDate(str(p.memberSince))}.
      </p>
      <Section title={`Verified volunteering · ${str(p.volunteeringHours)} hours`}>
        {volunteering.length ? (
          <ul className="space-y-1">
            {volunteering.map((v, i) => (
              <li key={i} className="flex justify-between gap-4 border-b border-[#1d1a14]/10 py-1.5">
                <span>
                  {str(v.title)} <span className="text-[#1d1a14]/55">· {fmtDate(str(v.date))} · verified by {str(v.verifiedBy) || "a teacher"}</span>
                </span>
                <span className="shrink-0 font-semibold">{str(v.hours)} h</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[#1d1a14]/55">None recorded.</p>
        )}
      </Section>
      <Section title="Certified courses">
        {courses.length ? (
          <ul className="space-y-1">
            {courses.map((c, i) => (
              <li key={i}>
                {str(c.title)} <span className="text-[#1d1a14]/55">· completed {fmtDate(str(c.completedAt))} · score {str(c.score)}%</span>
                {c.certificateId ? (
                  <>
                    {" "}
                    ·{" "}
                    <Link href={`/verify/${str(c.certificateId)}`} className="underline underline-offset-2">
                      certificate
                    </Link>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[#1d1a14]/55">None yet.</p>
        )}
      </Section>
      <Section title="Badges">
        <p>{badges.length ? badges.map((b) => `${str(b.title)} (${str(b.tier)})`).join(" · ") : <span className="text-[#1d1a14]/55">None yet.</span>}</p>
      </Section>
      <Section title="Projects">
        {projects.length ? (
          <ul className="space-y-2">
            {projects.map((x, i) => (
              <li key={i}>
                <strong>{str(x.title)}</strong> <span className="text-[#1d1a14]/55">· {x.verifiedBy ? `verified by ${str(x.verifiedBy)}` : "self-reported"}</span>
                <p>{str(x.description)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[#1d1a14]/55">None listed.</p>
        )}
      </Section>
      {letters.length ? (
        <Section title="Recommendation letters">
          <ul className="space-y-1">
            {letters.map((l, i) => (
              <li key={i}>
                <Link href={`/verify/${str(l.id)}`} className="underline underline-offset-2">
                  {str(l.title)}
                </Link>{" "}
                <span className="text-[#1d1a14]/55">· {str(l.by)} · {fmtDate(str(l.issuedAt))}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

function CertificateBody({ p }: { p: P }) {
  const skills = Array.isArray(p.skills) ? (p.skills as string[]) : [];
  return (
    <div className="py-4 text-center">
      <p className="text-[#1d1a14]/65">This certifies that</p>
      <p className="mt-2 font-display text-3xl font-semibold">{str(p.studentName)}</p>
      <p className="mt-3 text-[#1d1a14]/65">has successfully completed the mini-course</p>
      <p className="mt-2 font-display text-2xl font-semibold">{str(p.courseTitle)}</p>
      <p className="mt-4">
        About {str(p.minutes)} minutes of study, final assessment score <strong>{str(p.score)}%</strong>.
      </p>
      {skills.length ? <p className="mt-2 text-sm text-[#1d1a14]/65">Skills: {skills.join(", ")}</p> : null}
      <p className="mt-6 text-sm text-[#1d1a14]/65">{str(p.schoolName)}</p>
    </div>
  );
}

function LetterBody({ p }: { p: P }) {
  const purpose = { university: "University application", scholarship: "Scholarship application", volunteering: "Volunteering programme application", course: "Course accreditation" }[str(p.purpose)] ?? "";
  const course = (p.course ?? null) as { title?: string; skills?: string[]; score?: number | null; grant?: string | null } | null;
  return (
    <>
      <p className="mb-5 text-sm text-[#1d1a14]/65">
        Regarding <strong className="text-[#1d1a14]">{str(p.studentName)}</strong>
        {p.className ? `, ${str(p.className)}` : ""} · {purpose}
      </p>
      {course ? (
        <p className="-mt-3 mb-5 text-sm text-[#1d1a14]/65">
          Course: <strong className="text-[#1d1a14]">{str(course.title)}</strong>
          {course.score != null ? ` · final score ${course.score}%` : ""}
          {course.skills?.length ? ` · skills: ${course.skills.join(", ")}` : ""}
          {course.grant ? ` · funded by a ${course.grant} school grant` : ""}
        </p>
      ) : null}
      {str(p.body)
        .split(/\n{2,}/)
        .map((para, i) => (
          <p key={i} className="mb-4 whitespace-pre-line">
            {para}
          </p>
        ))}
      <div className="mt-8">
        <p className="font-display text-2xl italic">{str(p.teacherName)}</p>
        <p className="text-sm">
          {str(p.teacherName)}
          {p.teacherTitle ? `, ${str(p.teacherTitle)}` : ""}
        </p>
        <p className="text-sm text-[#1d1a14]/65">Homeroom teacher, {str(p.schoolName)}</p>
      </div>
    </>
  );
}
