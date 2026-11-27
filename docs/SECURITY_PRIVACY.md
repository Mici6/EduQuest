# Security & privacy

EduQuest serves minors. The design goal is that the safe behaviour is the default and is enforced in more than one place.

## Authorization model

| Data | Student | Teacher | Administrator | Support staff |
|---|---|---|---|---|
| Own grades, attendance, homework | ✓ | — | — | — |
| Other students' academic records | ✗ | Classes they teach | Own school | Caseload only |
| Support indicators, plans, notes | ✗ | ✗ | Aggregate counts only | Caseload only (audit-logged) |
| XP / credit balances | Own | — | Aggregates | — |
| Write grades / attendance | ✗ | Taught class + subject | ✗ | ✗ |
| Grant XP or credits | Never directly: only server-side domain events (graded quiz, verified volunteering) |

Enforced in: the `proxy.ts` route map, page guards (`requireActor`), domain permission and scope checks (`src/lib/auth/policy.ts`), database constraints (ledgers), and row-level security for the Postgres deployment (`supabase/migrations/0002_rls.sql`). The test suites `authz`, `credits` and `volunteering` cover these boundaries.

## Implemented safeguards

- HMAC-signed, HTTP-only, SameSite=Lax session cookies; claims include role and expiry; the DB is re-checked on every request.
- Server actions have built-in origin checks; route handlers check same-origin explicitly.
- Uploads are validated by content signature, size-limited, stored with sanitised names under private keys, and rate-limited.
- AI: keys are server-side only; per-user daily quotas; school-level switch; only the question and relevant lesson excerpts are sent to the provider (no grades or personal records); outputs are labelled by provenance.
- Append-only XP/credit ledgers; no credit-deduction path except a student-initiated redemption; idempotent, atomic redemption.
- Audit log of sensitive operations (grades, attendance, settings, redemptions, verifications, every support-record view) without storing record contents.
- Leaderboard is opt-in per student and per school, and shows XP only (first name + initial).
- Notifications respect per-category preferences, de-duplication and daily caps.
- Security headers (`X-Frame-Options`, `nosniff`, referrer and permissions policy).

## What is **not** claimed

Implementing these controls does not by itself make a deployment GDPR-compliant. Before production use with real students, a school/operator must still:

1. Establish the lawful basis (typically public task / legitimate interest for schools; consent where required) and parental-consent rules for minors in the relevant jurisdiction.
2. Complete a **Data Protection Impact Assessment**, especially for the student-support module and AI processing.
3. Sign a **data processing agreement** with every processor (hosting, Supabase, Anthropic) and verify data residency / transfer mechanisms.
4. Publish age-appropriate privacy notices for students and families, and define how subject-access, rectification and erasure requests are handled.
5. Configure retention periods (support-plan retention is configurable; schedule `eq_purge_expired_support_records`) and backup retention.
6. Restrict and review staff access (caseload assignment process, periodic access reviews, audit-log monitoring).
7. Penetration-test the deployment and replace the in-process rate limiter with a shared store.
8. Verify partner agreements before marking any business as a verified partner.
