import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  CalendarDays,
  Check,
  ClipboardCheck,
  Coins,
  Database,
  Eye,
  FileText,
  Flame,
  Gift,
  GraduationCap,
  HandHeart,
  HeartHandshake,
  Layers,
  ListChecks,
  Lock,
  MessagesSquare,
  Scale,
  School,
  ScanText,
  ShieldCheck,
  Sparkles,
  Store,
  Trophy,
  UserCog,
  Users,
  WandSparkles,
} from "lucide-react";
import { ContactForm } from "@/components/marketing/contact-form";
import { DashboardPhone, RewardsPhone, StudyPhone } from "@/components/marketing/phones";
import { Logo } from "@/components/shell/logo";
import { ButtonLink } from "@/components/ui/button";
import { getActor, homeFor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { json } from "@/lib/db/client";
import { cn } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "EduQuest — Learn. Level Up. Make a Difference.",
  description: "An AI-powered learning ecosystem that combines a school catalog, study tools, gamified progress, verified volunteering and teacher-accredited courses to help students stay engaged.",
};

const NAV = [
  ["Product", "#product"],
  ["AI tools", "#ai"],
  ["Courses", "#rewards"],
  ["Schools", "#schools"],
  ["Pricing", "#pricing"],
  ["Privacy", "#privacy"],
  ["FAQ", "#faq"],
];

const FAQ = [
  {
    q: "Is EduQuest free for students?",
    a: "Students at participating schools get every essential feature at no cost — the school's licence covers it. An optional Premium plan adds extras like higher AI limits, but never locks coursework, the catalog, volunteering or courses.",
  },
  {
    q: "Does the AI just give students the answers?",
    a: "No. The tutor explains, gives examples and guides students through methods step by step. It cites the teacher's own lesson materials and clearly marks anything that comes from general knowledge instead.",
  },
  {
    q: "What's the difference between XP and credits?",
    a: "XP measures learning progress and unlocks levels and cosmetic rewards — it can't be spent. Credits are earned only through verified volunteering and community activities, and can be spent on ready-made mini-courses.",
  },
  {
    q: "Can students lose credits?",
    a: "Never as a punishment. Credits are not removed for absences, grades or behaviour. The only way a balance goes down is when a student chooses to unlock a mini-course.",
  },
  {
    q: "How does the student-support module work?",
    a: "Transparent rules flag patterns such as several missed assignments or a change in attendance. Authorised support staff review every flag, record their reasoning, and decide together with the student whether a support plan would help. Nothing is automated, and students and classmates can't see these records.",
  },
  {
    q: "Is EduQuest GDPR compliant?",
    a: "EduQuest is built privacy-first: data minimisation, role-based access, audit logs and retention settings. Compliance also depends on each deployment's legal basis, contracts and processes, so we work through a data-protection checklist with every school before launch.",
  },
  {
    q: "Are the businesses in the demo real partners?",
    a: "No. The demo uses clearly labelled sample businesses. Real partners appear only after a signed agreement with the school or district.",
  },
];

function Section({ id, eyebrow, title, intro, children, className }: { id?: string; eyebrow: string; title: React.ReactNode; intro?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-24", className)}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sun-300">{eyebrow}</p>
      <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold leading-tight sm:text-[42px]">{title}</h2>
      {intro ? <p className="mt-4 max-w-2xl text-base text-fg-2">{intro}</p> : null}
      <div className="mt-12">{children}</div>
    </section>
  );
}

function Feature({ icon: Icon, title, children, tone = "sun" }: { icon: typeof Sparkles; title: string; children: React.ReactNode; tone?: "sun" | "iris" | "ember" | "mint" }) {
  const tones = { sun: "bg-sun-300/15 text-sun-200", iris: "bg-iris-400/15 text-iris-200", ember: "bg-ember/15 text-amber", mint: "bg-mint/15 text-mint" };
  return (
    <div className="surface rounded-[26px] p-6">
      <span className={cn("inline-flex size-11 items-center justify-center rounded-2xl", tones[tone])}>
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-fg-2">{children}</p>
    </div>
  );
}

export default async function Landing() {
  const actor = await getActor();
  const plans = getDb()
    .all<{ id: string; name: string; audience: string; description: string; features: string }>(`SELECT id, name, audience, description, features FROM subscription_plans ORDER BY CASE audience WHEN 'school' THEN 0 WHEN 'student_standard' THEN 1 ELSE 2 END`)
    .map((p) => ({ ...p, features: json<string[]>(p.features, []) }));

  return (
    <div className="overflow-x-clip">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-line/50 bg-ink-950/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="EduQuest home">
            <Logo />
          </Link>
          <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
            {NAV.map(([label, href]) => (
              <a key={href} href={href} className="rounded-full px-3 py-2 text-sm text-fg-2 hover:bg-white/[0.05] hover:text-fg">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {actor ? (
              <ButtonLink href={homeFor(actor.role)} size="sm">
                Open app <ArrowRight />
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
                  Sign in
                </ButtonLink>
                <ButtonLink href="/login" size="sm">
                  Try the demo
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="grid-dots absolute inset-0 opacity-50 [mask-image:radial-gradient(70%_60%_at_50%_30%,black,transparent)]" aria-hidden />
        <div className="absolute left-1/2 top-24 size-[620px] -translate-x-1/2 rounded-full bg-sun-300/[0.08] blur-3xl" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-16 text-center sm:px-6 sm:pt-24">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-line bg-ink-900/70 px-3 py-1.5 text-xs text-fg-2">
            <span className="size-1.5 rounded-full bg-mint" aria-hidden /> For secondary schools, teachers and students
          </p>
          <h1 className="mx-auto mt-6 max-w-4xl font-display text-[44px] font-semibold leading-[1.02] tracking-tight sm:text-7xl">
            Learn. Level Up. <span className="text-grad-sun">Make a Difference.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-fg-2 sm:text-lg">
            EduQuest transforms learning into an engaging journey by combining AI-powered education, academic progress, meaningful activities and teacher-accredited courses.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/login" size="lg">
              Explore the live demo <ArrowRight />
            </ButtonLink>
            <ButtonLink href="#schools" size="lg" variant="secondary">
              For schools
            </ButtonLink>
          </div>
          <p className="mt-4 text-xs text-fg-3">Demo uses fictional people and sample data · no sign-up needed</p>
        </div>

        <div id="product" className="relative mx-auto flex max-w-6xl scroll-mt-24 justify-center gap-6 px-4 pb-20 pt-6 [perspective:1600px] sm:px-6">
          <DashboardPhone className="hidden translate-y-10 -rotate-[5deg] md:block" />
          <StudyPhone className="z-10" />
          <RewardsPhone className="hidden translate-y-10 rotate-[5deg] md:block" />
        </div>
      </section>

      {/* Pillars strip */}
      <div className="border-y border-line/60 bg-ink-900/50">
        <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 sm:px-6 lg:grid-cols-4">
          {[
            [GraduationCap, "Electronic catalog", "Grades, attendance, homework, schedule"],
            [Sparkles, "AI study tools", "Grounded in teachers' lessons"],
            [Trophy, "Gamified progress", "XP, quests, streaks, achievements"],
            [HandHeart, "Accredited courses", "AI courses signed off by teachers"],
          ].map(([I, t, d]) => {
            const Icon = I as typeof Sparkles;
            return (
              <li key={t as string} className="flex items-start gap-3 py-6 pr-4">
                <Icon className="mt-0.5 size-5 shrink-0 text-sun-300" aria-hidden />
                <span>
                  <span className="block text-sm font-semibold">{t as string}</span>
                  <span className="block text-xs text-fg-3">{d as string}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <Section
        id="ai"
        eyebrow="AI learning tools"
        title={
          <>
            An AI study buddy that <span className="text-grad-sun">shows its sources</span>
          </>
        }
        intro="Teachers upload lessons; EduQuest extracts, indexes and makes them available to their students' study tools. Answers cite the lesson — and say so when they go beyond it."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Feature icon={MessagesSquare} title="Tutor chat" tone="iris">
            Ask questions, request simpler or deeper explanations, examples and practice questions. Grounded in class materials with clear citations.
          </Feature>
          <Feature icon={BookOpenCheck} title="Summaries & revision sheets">
            Concise or detailed notes, key concepts, definitions, formula sheets and important dates from any lesson.
          </Feature>
          <Feature icon={Layers} title="Flashcards with spaced repetition" tone="ember">
            Generated from lessons or notes, reviewed with a satisfying flip — the cards you find hardest come back sooner.
          </Feature>
          <Feature icon={ListChecks} title="Quizzes & practice tests" tone="mint">
            Multiple choice, true/false and short answer with explanations after every attempt — and revision suggestions for what you missed.
          </Feature>
          <Feature icon={ScanText} title="Homework helper" tone="iris">
            Paste a question or upload a photo or PDF. EduQuest guides the method step by step instead of handing over an answer.
          </Feature>
          <Feature icon={FileText} title="Honest document processing">
            PDF, DOCX and text are extracted on the server; images need OCR, which isn't available yet.
          </Feature>
        </div>
      </Section>

      <Section
        eyebrow="Electronic catalog"
        title="Everything a school record needs — beautifully clear"
        intro="Students see their own grades, attendance, homework and timetable. Teachers enter grades and attendance in seconds. Nobody sees another student's record."
        className="!pt-0"
      >
        <div className="grid gap-4 md:grid-cols-4">
          {[
            [GraduationCap, "Grades", "Weighted averages, trends and history by subject"],
            [ClipboardCheck, "Attendance", "Calendar view — never linked to rewards or penalties"],
            [FileText, "Homework", "Submit with attachments, get feedback"],
            [CalendarDays, "Schedule", "Weekly timetable with rooms and teachers"],
          ].map(([I, t, d]) => {
            const Icon = I as typeof Sparkles;
            return (
              <div key={t as string} className="rounded-[22px] border border-line bg-ink-900/60 p-5">
                <Icon className="size-5 text-sun-300" aria-hidden />
                <p className="mt-3 font-semibold">{t as string}</p>
                <p className="mt-1 text-sm text-fg-3">{d as string}</p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section id="rewards" eyebrow="Gamification, volunteering & courses" title="Two currencies, one simple promise" intro="Progress is celebrated, good deeds are rewarded, and nothing is ever taken away as a punishment.">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="grad-sun relative overflow-hidden rounded-[32px] p-8 text-ink-950">
            <Flame className="size-8" aria-hidden />
            <h3 className="mt-6 font-display text-3xl font-semibold">XP — for learning</h3>
            <p className="mt-3 max-w-md text-ink-950/75">Earned by finishing quizzes, reviewing flashcards, handing in homework and completing quests. Unlocks levels, achievements and cosmetic frames. Never spendable.</p>
            <ul className="mt-6 space-y-2 text-sm font-medium">
              {["Daily quests and weekly challenges", "Streaks that restart without penalty", "Study-time XP capped daily to avoid excess screen time", "Opt-in leaderboard showing XP only"].map((x) => (
                <li key={x} className="flex gap-2">
                  <Check className="size-4 shrink-0" aria-hidden /> {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-ember to-ember-deep p-8 text-ink-950">
            <Coins className="size-8" aria-hidden />
            <h3 className="mt-6 font-display text-3xl font-semibold">Credits — for good deeds</h3>
            <p className="mt-3 max-w-md text-ink-950/80">Earned only through approved volunteering — recycling drives, library afternoons, community projects — once an organiser verifies participation. Spent on ready-made mini-courses; AI courses can also be funded by school grants.</p>
            <ul className="mt-6 space-y-2 text-sm font-medium">
              {["Never confiscated for absences, grades or behaviour", "Double-spend-proof course unlocks", "Every change recorded in an append-only ledger", "Grants capped by each school's own budget"].map((x) => (
                <li key={x} className="flex gap-2">
                  <Check className="size-4 shrink-0" aria-hidden /> {x}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Feature icon={HandHeart} title="Volunteering board" tone="mint">
            Students browse approved activities, register in one tap and see places left. Organisers verify attendance afterwards.
          </Feature>
          <Feature icon={Gift} title="AI courses & grants" tone="ember">
            Any topic, from first aid to debate. A teacher reviews each course, the school can fund it with a grant, and the teacher accredits it with a signed letter.
          </Feature>
          <Feature icon={Trophy} title="Achievements" tone="sun">
            First Quiz, Seven-Day Streak, Science Explorer, Bookworm, Helpful Student, Community Contributor, Master of Mathematics…
          </Feature>
        </div>
      </Section>

      <Section eyebrow="Teacher tools" title="Less admin, more teaching" intro="A teacher dashboard built around the week: classes, grade entry, attendance, assignments and an AI Studio that never publishes without review.">
        <div className="grid gap-4 md:grid-cols-3">
          <Feature icon={WandSparkles} title="AI Studio" tone="iris">
            Turn a lesson into a quiz, practice test, flashcards, summary or homework draft. Edit everything, save drafts, publish when ready.
          </Feature>
          <Feature icon={Users} title="Class overview">
            Averages, attendance and homework completion per class and subject, with a roster you can grade from directly.
          </Feature>
          <Feature icon={HandHeart} title="Verified volunteering" tone="mint">
            Create activities and verify participation — credits are released exactly once per student.
          </Feature>
        </div>
      </Section>

      <Section
        eyebrow="School support & early intervention"
        title={
          <>
            Notice early. <span className="text-grad-sun">Decide together.</span>
          </>
        }
        intro="EduQuest helps authorised support staff notice patterns that may signal a student is struggling — and then gets out of the way so people can help."
      >
        <ol className="grid gap-3 md:grid-cols-4">
          {[
            ["Indicator", "Transparent rules spot changes in grades, missing work, attendance or activity."],
            ["Human review", "Support staff review each flag and record a rationale — confirm or dismiss."],
            ["Support plan", "Goals and supportive actions agreed with the student, with a review date."],
            ["Follow-up", "Notes, progress review and retention dates. Every access is audit-logged."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-[22px] border border-line bg-ink-900/60 p-5">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-sun-200 text-sm font-bold text-ink-950">{i + 1}</span>
              <p className="mt-3 font-semibold">{t}</p>
              <p className="mt-1 text-sm text-fg-3">{d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 flex items-start gap-2 text-sm text-fg-2">
          <Scale className="mt-0.5 size-4 shrink-0 text-iris-300" aria-hidden /> No diagnoses, no labels, no predictions, no automatic consequences. EduQuest aims to help reduce disengagement; it doesn't promise outcomes.
        </p>
      </Section>

      <Section id="schools" eyebrow="School partnerships" title="Built for whole-school adoption" intro="Schools license EduQuest for every student. NGOs and organisers can publish volunteering opportunities.">
        <div className="grid gap-4 md:grid-cols-3">
          <Feature icon={School} title="For schools">
            Catalog, dashboards for every role, AI tools with school-wide policies and limits, gamification, volunteering, AI courses with grants, and the support module.
          </Feature>
          <Feature icon={Store} title="For teachers" tone="ember">
            Review AI-written courses before students start, approve grants from the school budget, and accredit finished courses with a signed letter.
          </Feature>
          <Feature icon={HeartHandshake} title="For NGOs & organisers" tone="mint">
            Publish volunteering opportunities and verify participation — students earn credits for real contributions.
          </Feature>
        </div>
      </Section>

      <Section id="pricing" eyebrow="Pricing" title="Fair by design" intro="Essential features are free for students at participating schools. Prices are set per contract and published at launch — this demo doesn't show final prices.">
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((p, i) => (
            <div key={p.id} className={cn("flex flex-col rounded-[28px] p-6", i === 0 ? "grad-sun text-ink-950" : "surface")}>
              <p className={cn("text-xs font-semibold uppercase tracking-wider", i === 0 ? "text-ink-950/70" : "text-sun-300")}>
                {p.audience === "school" ? "For schools" : p.audience === "student_standard" ? "For students without a school licence" : "Optional upgrade"}
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold">{p.name}</h3>
              <p className={cn("mt-2 text-sm", i === 0 ? "text-ink-950/75" : "text-fg-2")}>{p.description}</p>
              <p className="mt-5 font-display text-lg font-semibold">{p.audience === "school" ? "Per-school contract" : "Price announced at launch"}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className={cn("mt-0.5 size-4 shrink-0", i === 0 ? "" : "text-mint")} aria-hidden /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section id="privacy" eyebrow="Privacy & security" title="Designed for minors, from the database up">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Feature icon={UserCog} title="Role-based access" tone="iris">
            Enforced on the server and in database policies: students see only their own records; teachers only their classes; support records only their caseload.
          </Feature>
          <Feature icon={Database} title="Data minimisation" tone="mint">
            Only what's needed for school and learning. AI requests send questions and lesson excerpts — never grades or personal records.
          </Feature>
          <Feature icon={Eye} title="Audit logging">
            Sensitive actions and every read of a support record are logged — who, what and when, never record contents.
          </Feature>
          <Feature icon={Lock} title="Secure by default" tone="ember">
            Signed HTTP-only sessions, validated uploads (checked by content, not extension), rate limits and server-side keys.
          </Feature>
          <Feature icon={ShieldCheck} title="Append-only ledgers" tone="mint">
            XP and credit ledgers can't be edited or deleted, and the database rejects any credit deduction that isn't a course a student chose.
          </Feature>
          <Feature icon={BadgeCheck} title="Honest about compliance">
            Privacy-conscious architecture plus a deployment checklist for the legal and organisational steps GDPR requires.
          </Feature>
        </div>
      </Section>

      <Section id="faq" eyebrow="FAQ" title="Questions, answered">
        <div className="mx-auto max-w-3xl space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group surface rounded-[22px] px-5 py-4 open:pb-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {f.q}
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-fg-2 transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-fg-2">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <Section id="contact" eyebrow="Contact" title="Bring EduQuest to your school" intro="Tell us about your school, business or organisation and we'll get back to you.">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            <div className="surface rounded-[26px] p-6">
              <Sparkles className="size-6 text-sun-300" aria-hidden />
              <p className="mt-3 font-display text-lg font-semibold">See it first</p>
              <p className="mt-1 text-sm text-fg-2">The live demo includes student, teacher, administrator and support-staff accounts with sample data.</p>
              <ButtonLink href="/login" variant="secondary" size="sm" className="mt-4">
                Open the demo <ArrowRight />
              </ButtonLink>
            </div>
            <p className="text-xs text-fg-3">We never ask for student data through this form.</p>
          </div>
          <div className="surface rounded-[26px] p-6 sm:p-8">
            <ContactForm />
          </div>
        </div>
      </Section>

      <footer className="border-t border-line/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Logo gid="eq-g-foot" />
            <p className="mt-2 max-w-sm text-xs text-fg-3">Learn. Level up. Make a difference. A learning ecosystem for engaged, supported students.</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg-2">
            {NAV.map(([label, href]) => (
              <a key={href} href={href} className="hover:text-fg">
                {label}
              </a>
            ))}
            <Link href="/login" className="hover:text-fg">
              Demo
            </Link>
          </nav>
        </div>
        <p className="border-t border-line/40 px-4 py-4 text-center text-[11px] text-fg-3">
          Demo build · all people, schools and businesses shown are fictional or sample data · © {new Date().getFullYear()} EduQuest
        </p>
      </footer>
    </div>
  );
}
