-- EduQuest production schema (PostgreSQL / Supabase).
-- Generated from src/lib/db/schema.ts (the demo SQLite schema) so both backends
-- share table and column names. Timestamps are TIMESTAMPTZ; dates are TEXT
-- ISO dates (YYYY-MM-DD) to match the domain layer.

-- Links application users to Supabase Auth identities.


CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schools (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  city        TEXT,
  is_demo     BOOLEAN NOT NULL DEFAULT true,
  settings    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  auth_user_id  UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  school_id     TEXT NOT NULL REFERENCES schools(id),
  role          TEXT NOT NULL CHECK (role IN ('student','teacher','admin','support')),
  display_name  TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  avatar_hue    INTEGER NOT NULL DEFAULT 40,
  title         TEXT,
  grade_level   INTEGER,
  is_demo       INTEGER NOT NULL DEFAULT 1,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings    JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS subjects (
  id          TEXT PRIMARY KEY,
  school_id   TEXT NOT NULL REFERENCES schools(id),
  name        TEXT NOT NULL,
  short       TEXT NOT NULL,
  color       TEXT NOT NULL,
  icon        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  id                  TEXT PRIMARY KEY,
  school_id           TEXT NOT NULL REFERENCES schools(id),
  name                TEXT NOT NULL,
  grade_level         INTEGER NOT NULL,
  homeroom_teacher_id TEXT REFERENCES users(id),
  academic_year       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS class_memberships (
  class_id    TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, user_id)
);

-- Which teacher teaches which subject to which class.
CREATE TABLE IF NOT EXISTS teaching_assignments (
  teacher_id  TEXT NOT NULL REFERENCES users(id),
  class_id    TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id  TEXT NOT NULL REFERENCES subjects(id),
  PRIMARY KEY (teacher_id, class_id, subject_id)
);

CREATE TABLE IF NOT EXISTS schedule_slots (
  id          TEXT PRIMARY KEY,
  class_id    TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id  TEXT NOT NULL REFERENCES subjects(id),
  teacher_id  TEXT NOT NULL REFERENCES users(id),
  weekday     INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  starts_at   TEXT NOT NULL,
  ends_at     TEXT NOT NULL,
  room        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grades (
  id          TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL REFERENCES users(id),
  class_id    TEXT NOT NULL REFERENCES classes(id),
  subject_id  TEXT NOT NULL REFERENCES subjects(id),
  teacher_id  TEXT NOT NULL REFERENCES users(id),
  value       NUMERIC(4,2) NOT NULL CHECK (value >= 1 AND value <= 10),
  weight      NUMERIC(4,2) NOT NULL DEFAULT 1,
  kind        TEXT NOT NULL CHECK (kind IN ('test','quiz','oral','project','homework')),
  title       TEXT NOT NULL,
  graded_on   TEXT NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS grades_student ON grades(student_id, subject_id, graded_on);

CREATE TABLE IF NOT EXISTS attendance (
  id          TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL REFERENCES users(id),
  class_id    TEXT NOT NULL REFERENCES classes(id),
  subject_id  TEXT NOT NULL REFERENCES subjects(id),
  recorded_by TEXT NOT NULL REFERENCES users(id),
  date        TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
  note        TEXT,
  UNIQUE (student_id, subject_id, date)
);
CREATE INDEX IF NOT EXISTS attendance_student ON attendance(student_id, date);

CREATE TABLE IF NOT EXISTS assignments (
  id          TEXT PRIMARY KEY,
  class_id    TEXT NOT NULL REFERENCES classes(id),
  subject_id  TEXT NOT NULL REFERENCES subjects(id),
  teacher_id  TEXT NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  due_at      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  origin      TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual','ai_reviewed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submissions (
  id            TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id    TEXT NOT NULL REFERENCES users(id),
  body          TEXT,
  file_name     TEXT,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','returned')),
  feedback      TEXT,
  UNIQUE (assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id          TEXT PRIMARY KEY,
  school_id   TEXT NOT NULL REFERENCES schools(id),
  class_id    TEXT REFERENCES classes(id),
  author_id   TEXT NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  pinned      INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  school_id   TEXT NOT NULL REFERENCES schools(id),
  class_id    TEXT REFERENCES classes(id),
  title       TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('exam','event','holiday','meeting')),
  date        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category    TEXT NOT NULL CHECK (category IN ('academic','announcement','gamification','rewards','volunteering','study','system')),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  href        TEXT,
  dedupe_key  TEXT,
  read_at     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id, created_at);

-- Documents & retrieval ------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id            TEXT PRIMARY KEY,
  school_id     TEXT NOT NULL REFERENCES schools(id),
  owner_id      TEXT NOT NULL REFERENCES users(id),
  class_id      TEXT REFERENCES classes(id),
  subject_id    TEXT REFERENCES subjects(id),
  title         TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  storage_key   TEXT,
  visibility    TEXT NOT NULL CHECK (visibility IN ('private','class','school')),
  status        TEXT NOT NULL CHECK (status IN ('uploaded','validating','extracting','chunking','indexed','needs_ocr','failed')),
  status_detail TEXT,
  char_count    INTEGER NOT NULL DEFAULT 0,
  chunk_count   INTEGER NOT NULL DEFAULT 0,
  embeddings    TEXT NOT NULL DEFAULT 'none' CHECK (embeddings IN ('none','lexical','vector')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id           TEXT PRIMARY KEY,
  document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  heading      TEXT,
  content      TEXT NOT NULL,
  token_count  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS chunks_doc ON document_chunks(document_id, position);

-- AI ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_conversations (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  mode        TEXT NOT NULL DEFAULT 'tutor',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content         TEXT NOT NULL,
  sources         TEXT NOT NULL DEFAULT '[]',
  grounding       TEXT,
  provider        TEXT,
  simulated       INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_usage (
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day       TEXT NOT NULL,
  requests  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- Study tools -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flashcard_sets (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL REFERENCES users(id),
  class_id    TEXT REFERENCES classes(id),
  subject_id  TEXT REFERENCES subjects(id),
  document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
  origin      TEXT NOT NULL CHECK (origin IN ('manual','ai','simulated')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flashcards (
  id        TEXT PRIMARY KEY,
  set_id    TEXT NOT NULL REFERENCES flashcard_sets(id) ON DELETE CASCADE,
  front     TEXT NOT NULL,
  back      TEXT NOT NULL,
  position  INTEGER NOT NULL
);

-- Leitner-style spaced repetition state per (card, student).
CREATE TABLE IF NOT EXISTS flashcard_progress (
  card_id      TEXT NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  box          INTEGER NOT NULL DEFAULT 1 CHECK (box BETWEEN 1 AND 5),
  correct      INTEGER NOT NULL DEFAULT 0,
  incorrect    INTEGER NOT NULL DEFAULT 0,
  due_on       TEXT NOT NULL,
  reviewed_at  TEXT,
  PRIMARY KEY (card_id, user_id)
);

CREATE TABLE IF NOT EXISTS quizzes (
  id           TEXT PRIMARY KEY,
  owner_id     TEXT NOT NULL REFERENCES users(id),
  class_id     TEXT REFERENCES classes(id),
  subject_id   TEXT REFERENCES subjects(id),
  document_id  TEXT REFERENCES documents(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  topic        TEXT,
  difficulty   TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  kind         TEXT NOT NULL DEFAULT 'quiz' CHECK (kind IN ('quiz','practice_test')),
  time_limit_s INTEGER,
  status       TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
  origin       TEXT NOT NULL CHECK (origin IN ('manual','ai','simulated')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id          TEXT PRIMARY KEY,
  quiz_id     TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('mcq','true_false','short')),
  prompt      TEXT NOT NULL,
  options     TEXT NOT NULL DEFAULT '[]',
  answer      TEXT NOT NULL,
  explanation TEXT NOT NULL,
  topic       TEXT
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id            TEXT PRIMARY KEY,
  quiz_id       TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id    TEXT NOT NULL REFERENCES users(id),
  score         INTEGER NOT NULL,
  total         INTEGER NOT NULL,
  answers       TEXT NOT NULL,
  duration_s    INTEGER,
  xp_awarded    INTEGER NOT NULL DEFAULT 0,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS study_sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  minutes     INTEGER NOT NULL CHECK (minutes > 0 AND minutes <= 240),
  activity    TEXT NOT NULL,
  day         TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Gamification ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS levels (
  level        INTEGER PRIMARY KEY,
  xp_required  INTEGER NOT NULL,
  title        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS xp_transactions (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id),
  amount           INTEGER NOT NULL CHECK (amount > 0),
  reason           TEXT NOT NULL,
  source_type      TEXT NOT NULL,
  source_id        TEXT,
  idempotency_key  TEXT NOT NULL UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xp_user ON xp_transactions(user_id, created_at);

CREATE TABLE IF NOT EXISTS achievements (
  id           TEXT PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  icon         TEXT NOT NULL,
  tier         TEXT NOT NULL CHECK (tier IN ('bronze','silver','gold')),
  xp_bonus     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS student_achievements (
  user_id         TEXT NOT NULL REFERENCES users(id),
  achievement_id  TEXT NOT NULL REFERENCES achievements(id),
  earned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS quests (
  id           TEXT PRIMARY KEY,
  school_id    TEXT NOT NULL REFERENCES schools(id),
  cadence      TEXT NOT NULL CHECK (cadence IN ('daily','weekly')),
  metric       TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  target       INTEGER NOT NULL CHECK (target > 0),
  xp_reward    INTEGER NOT NULL CHECK (xp_reward > 0),
  difficulty   TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  active       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS quest_progress (
  user_id       TEXT NOT NULL REFERENCES users(id),
  quest_id      TEXT NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  period_key    TEXT NOT NULL,
  progress      INTEGER NOT NULL DEFAULT 0,
  completed_at  TEXT,
  claimed_at    TEXT,
  PRIMARY KEY (user_id, quest_id, period_key)
);

-- Credits (a separate reward currency; never deducted as punishment) -------------
CREATE TABLE IF NOT EXISTS credit_transactions (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id),
  amount           INTEGER NOT NULL CHECK (amount <> 0),
  kind             TEXT NOT NULL CHECK (kind IN ('earn','redeem','refund')),
  reason           TEXT NOT NULL,
  source_type      TEXT NOT NULL CHECK (source_type IN ('volunteering','voucher_redemption','redemption_refund')),
  source_id        TEXT NOT NULL,
  idempotency_key  TEXT NOT NULL UNIQUE,
  created_by       TEXT REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Debits exist only to pay for a voucher the student chose to redeem.
  CHECK ((kind = 'redeem' AND amount < 0 AND source_type = 'voucher_redemption')
      OR (kind = 'earn'   AND amount > 0 AND source_type = 'volunteering')
      OR (kind = 'refund' AND amount > 0 AND source_type = 'redemption_refund'))
);
CREATE INDEX IF NOT EXISTS credits_user ON credit_transactions(user_id, created_at);

-- Volunteering ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS volunteering_activities (
  id                TEXT PRIMARY KEY,
  school_id         TEXT NOT NULL REFERENCES schools(id),
  organizer_id      TEXT NOT NULL REFERENCES users(id),
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  category          TEXT NOT NULL,
  location          TEXT NOT NULL,
  starts_at         TEXT NOT NULL,
  duration_minutes  INTEGER NOT NULL,
  capacity          INTEGER NOT NULL CHECK (capacity > 0),
  credits           INTEGER NOT NULL CHECK (credits > 0),
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','closed','completed'))
);

CREATE TABLE IF NOT EXISTS volunteering_registrations (
  id             TEXT PRIMARY KEY,
  activity_id    TEXT NOT NULL REFERENCES volunteering_activities(id) ON DELETE CASCADE,
  student_id     TEXT NOT NULL REFERENCES users(id),
  status         TEXT NOT NULL CHECK (status IN ('registered','cancelled','verified','not_verified')),
  registered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at    TEXT,
  verified_by    TEXT REFERENCES users(id),
  UNIQUE (activity_id, student_id)
);

-- Rewards marketplace ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reward_partners (
  id                   TEXT PRIMARY KEY,
  school_id            TEXT NOT NULL REFERENCES schools(id),
  name                 TEXT NOT NULL,
  category             TEXT NOT NULL,
  description          TEXT NOT NULL,
  verification_status  TEXT NOT NULL CHECK (verification_status IN ('sample','pending','verified')),
  agreement_ref        TEXT
);

CREATE TABLE IF NOT EXISTS reward_offers (
  id                 TEXT PRIMARY KEY,
  partner_id         TEXT NOT NULL REFERENCES reward_partners(id),
  title              TEXT NOT NULL,
  description        TEXT NOT NULL,
  discount_label     TEXT NOT NULL,
  credit_cost        INTEGER NOT NULL CHECK (credit_cost > 0),
  stock              INTEGER NOT NULL CHECK (stock >= 0),
  per_student_limit  INTEGER NOT NULL DEFAULT 1 CHECK (per_student_limit > 0),
  expires_on         TEXT NOT NULL,
  terms              TEXT NOT NULL,
  active             INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS voucher_redemptions (
  id            TEXT PRIMARY KEY,
  offer_id      TEXT NOT NULL REFERENCES reward_offers(id),
  student_id    TEXT NOT NULL REFERENCES users(id),
  credit_tx_id  TEXT NOT NULL UNIQUE REFERENCES credit_transactions(id),
  code          TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','used','expired')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Student support (restricted) ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_caseload (
  staff_id    TEXT NOT NULL REFERENCES users(id),
  student_id  TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (staff_id, student_id)
);

CREATE TABLE IF NOT EXISTS support_indicators (
  id            TEXT PRIMARY KEY,
  student_id    TEXT NOT NULL REFERENCES users(id),
  kind          TEXT NOT NULL CHECK (kind IN ('grade_decline','missing_assignments','attendance_change','engagement_drop')),
  strength      TEXT NOT NULL CHECK (strength IN ('low','moderate','notable')),
  summary       TEXT NOT NULL,
  evidence      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','confirmed','dismissed','resolved')),
  detected_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  detector      TEXT NOT NULL,
  fingerprint   TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS support_reviews (
  id            TEXT PRIMARY KEY,
  indicator_id  TEXT NOT NULL REFERENCES support_indicators(id) ON DELETE CASCADE,
  reviewer_id   TEXT NOT NULL REFERENCES users(id),
  decision      TEXT NOT NULL CHECK (decision IN ('confirmed','dismissed')),
  rationale     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intervention_plans (
  id            TEXT PRIMARY KEY,
  student_id    TEXT NOT NULL REFERENCES users(id),
  indicator_id  TEXT REFERENCES support_indicators(id),
  owner_id      TEXT NOT NULL REFERENCES users(id),
  goals         TEXT NOT NULL,
  actions       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','monitoring','closed')),
  review_on     TEXT NOT NULL,
  retain_until  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intervention_notes (
  id          TEXT PRIMARY KEY,
  plan_id     TEXT NOT NULL REFERENCES intervention_plans(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES users(id),
  kind        TEXT NOT NULL CHECK (kind IN ('note','follow_up','progress_review')),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Business ----------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_plans (
  id           TEXT PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  audience     TEXT NOT NULL CHECK (audience IN ('school','student_standard','student_premium')),
  description  TEXT NOT NULL,
  features     TEXT NOT NULL,
  price_minor  INTEGER,
  currency     TEXT,
  interval     TEXT,
  ai_daily_requests INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS school_subscriptions (
  school_id   TEXT NOT NULL REFERENCES schools(id),
  plan_id     TEXT NOT NULL REFERENCES subscription_plans(id),
  status      TEXT NOT NULL CHECK (status IN ('demo','trial','active','ended')),
  seats       INTEGER NOT NULL,
  starts_on   TEXT NOT NULL,
  ends_on     TEXT,
  PRIMARY KEY (school_id, plan_id)
);

-- Demo / contact requests from the public site (minimal fields, explicit consent).
CREATE TABLE IF NOT EXISTS contact_requests (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  organisation TEXT NOT NULL,
  role        TEXT NOT NULL,
  message     TEXT,
  consent_at  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id             TEXT PRIMARY KEY,
  actor_id       TEXT REFERENCES users(id),
  action         TEXT NOT NULL,
  resource_type  TEXT NOT NULL,
  resource_id    TEXT,
  metadata       TEXT NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_created ON audit_logs(created_at);


-- ── Ledger integrity ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION eq_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% is append-only', TG_TABLE_NAME; END $$;

CREATE TRIGGER xp_append_only BEFORE UPDATE OR DELETE ON xp_transactions FOR EACH ROW EXECUTE FUNCTION eq_append_only();
CREATE TRIGGER credits_append_only BEFORE UPDATE OR DELETE ON credit_transactions FOR EACH ROW EXECUTE FUNCTION eq_append_only();

CREATE OR REPLACE FUNCTION eq_credits_non_negative() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.amount < 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id));
    IF (SELECT COALESCE(SUM(amount), 0) FROM credit_transactions WHERE user_id = NEW.user_id) + NEW.amount < 0 THEN
      RAISE EXCEPTION 'insufficient credits';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER credits_non_negative BEFORE INSERT ON credit_transactions FOR EACH ROW EXECUTE FUNCTION eq_credits_non_negative();
