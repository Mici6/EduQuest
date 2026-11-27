# Architecture

## Stack

- **Next.js 16 (App Router) + React 19 + TypeScript**, Tailwind CSS v4 with a custom design system (no UI kit): `src/components/ui`.
- **Data**: a domain layer over a thin SQL wrapper (`src/lib/db/client.ts`). Demo mode uses Node's built-in `node:sqlite` with WAL; production targets PostgreSQL on Supabase. The SQL schema is shared by name (`src/lib/db/schema.ts` ↔ `supabase/migrations`).
- **AI**: provider-neutral task interface (`src/lib/ai/types.ts`) with an Anthropic implementation (`@anthropic-ai/sdk`, structured outputs via Zod, streaming chat) and a rule-based simulator.
- **Charts**: Recharts, loaded lazily on the client, with a palette validated for colour-vision deficiency on the dark surface, plus a table view on every chart.
- **Tests**: Vitest (domain, in-memory DB) + a route smoke script.

## Layout

```
src/
  app/                    routes (landing, login, /app/** role areas, /api/**)
  actions/                server actions — authenticate, validate, call the domain, refresh
  components/             ui primitives, shell, and feature components per area
  lib/
    auth/                 session tokens, roles, permission matrix + scope checks, route map
    db/                   connection, schema, demo seed
    domain/               business logic: catalog, gamification, credits, AI courses & grants,
                          study (flashcards/quizzes), documents, ai-service, support,
                          notifications, admin, audit, recommendations
    ai/                   providers, prompts, retrieval (BM25), text tools, guard (policy + quota)
    documents/            validation (magic bytes), extraction, chunking, storage adapter
  proxy.ts                early role-based redirects for /app/**
supabase/migrations/      PostgreSQL schema, RLS policies, atomic SQL functions
```

**Rule**: UI components never contain business rules. Every mutation goes through a server action → domain function that receives the authenticated `Actor` and checks permissions and scope itself.

## Request flow

1. `proxy.ts` verifies the signed session cookie and redirects a role away from another role's section (convenience layer).
2. Pages call `requireActor(roles)`; the actor is re-loaded from the database (deactivated users and role changes end the session).
3. Domain functions call `assertCan` (role permissions) and scope checks (`canReadAcademicRecord`, `assertTeacherOfClass`, `assertSupportAccess`).
4. Server actions return `{ ok, data | error }`; framework redirects are re-thrown; the router is refreshed after mutations.

## Gamification, credits & courses

- **XP**: append-only `xp_transactions` with unique idempotency keys (`quiz:{quiz}:{user}:{day}`, `submit:{assignment}:{user}`, …). XP is computed on the server from graded results; no endpoint accepts an XP amount. Daily caps on study time (30) and flashcards (40).
- **Quests**: events (`recordProgress`) advance daily/weekly quest rows; students claim completed quests once.
- **Credits**: separate append-only ledger. Credits are earned by verified volunteering and spent only on mini-course unlocks (idempotent per course); a trigger blocks overdrafts, and another rejects rows from the removed voucher shop.
- **AI courses** (`ai_courses`): a student requests a course on any topic; the AI drafts lessons and a quiz; the chosen teacher reviews it and may approve a grant (never above the school's remaining `grantBudget`); the server grades the quiz; the teacher accredits it by signing a sealed letter of recommendation (`credentials`, kind `recommendation`, purpose `course`).

## AI layer

- `getProvider()` returns Anthropic when a key is present, otherwise the labelled simulator, or throws "unavailable".
- `aiFor()` applies school policy (AI on/off for students) and the per-user daily quota before any provider call.
- **Grounding**: documents the user may read → BM25 retrieval over chunks → if the top score passes a threshold, excerpts are sent as `[S1]…` and the UI shows sources; otherwise the answer is labelled "Not found in your materials". The system prompt requires a "Beyond your lesson materials:" marker for general knowledge, which the UI renders distinctly.
- Generators use structured outputs validated with Zod; teacher outputs are saved as **drafts** and must be published explicitly.

## Document pipeline

`/api/documents` streams real step events: validate (extension *and* magic bytes, size) → store (local disk / Supabase Storage) → extract (UTF-8, `unpdf`, `mammoth`; images and scans → OCR via Claude vision only when configured, otherwise status `needs_ocr`) → chunk (heading-aware, overlapping) → index (lexical BM25; `embeddings` column reserved for a vector index).

## Student support

Rule-based detector `rules-v1` (grade decline per subject, missing assignments, attendance change, reduced activity) creates `pending_review` indicators, at most one open per kind and student. Review requires a rationale; plans require a confirmed indicator; notes, status and retention dates follow. Reads are audit-logged. Nothing in this module changes grades, XP, credits or access.
