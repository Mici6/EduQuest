# Feature status

## Fully functional (demo mode)

- **Auth & roles**: demo sign-in for 36 fictional accounts, role switching, signed sessions, role-based routing, server-side permission + scope checks on every action.
- **Student dashboard**: greeting, level/XP, streak, credits, next class with countdown, daily quests with claiming, study-time logging, today's timeline, academic overview, homework due, AI entry point, rewards progress, upcoming events.
- **Catalog**: grades by subject with trends and history chart, assessments table, attendance calendar and statistics, announcements, teachers, statistics charts; homework submission with validated attachments and teacher feedback; weekly schedule and month calendar.
- **Study tools**: tutor chat (streaming, grounded with citations, level control, follow-up actions, conversation history), summaries, flashcard generation/review (Leitner scheduling, flip UI, keyboard), quiz and practice-test generation, quiz taking (timer, server-side grading, explanations, revision topics), homework helper (guided steps, photo/PDF intake), study plans, revision suggestions.
- **Documents**: upload → validate → store → extract (TXT/MD, PDF text layer, DOCX) → chunk → index, with live per-step status; library, extracted-text view, deletion; image/scan uploads honestly marked "Needs OCR".
- **Gamification**: XP ledger with idempotency, levels, quests, streaks, 9 achievements, cosmetic profile frames, opt-in leaderboard, XP history and chart.
- **Volunteering & credits**: registration with capacity, cancellation, organizer verification (credits once), activity creation; credits unlock ready-made mini-courses.
- **AI courses & grants**: AI-written courses on any topic, teacher review (approve / send back), grants from the school budget, server-graded quiz, accreditation with a signed letter of recommendation; admin grant budget page.
- **Teacher**: dashboard, class roster with grade entry, attendance sheet, assignments and submission review, AI Studio (generate → edit → draft → publish), announcements, volunteering verification.
- **Admin**: overview analytics, people (add / deactivate), classes, subjects, teaching assignments, school announcements, grants, plans & pricing configuration, school policies, permission matrix, integrations status, audit log, demo reset.
- **Student support**: rule-based detection, review queue, evidence and trend charts, mandatory rationale, support plans, notes timeline, status, before/after progress review, retention dates, audit logging.
- **Notifications**: in-app centre with categories, read/unread, preferences, de-duplication and daily caps.
- **Landing page** with all sections and a working contact form (stored locally with consent).
- **PWA manifest** and icons; responsive layouts with container queries; mobile bottom navigation.

## Needs credentials or configuration

- **Live AI** (Claude) for the tutor, generators, study plans, homework help: set `ANTHROPIC_API_KEY`. Code is implemented; it was exercised only through the simulator in this build.
- **OCR** for images and scanned PDFs: uses Claude vision when a key is present.

## Needs further development

- PostgreSQL/Supabase data adapter and Supabase Auth/SSO sign-in (schema, RLS and SQL functions are written but not yet executed against Postgres).
- Supabase Storage adapter; virus scanning of uploads.
- Vector embeddings (the retrieval interface and `embeddings` column are in place; BM25 is used today).
- Email/push notifications, payments/subscription billing.
- Parent/guardian accounts, multi-school tenancy UI, internationalisation.
- Offline support (service worker) and shared-store rate limiting.
- Scheduled jobs (nightly detection, retention purge) — functions exist; scheduling is deployment-specific.
