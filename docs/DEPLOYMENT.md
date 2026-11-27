# Deployment

## Demo deployment (any Node.js 22.13+ host)

```bash
npm ci
npm run build
EDUQUEST_MODE=demo SESSION_SECRET=$(openssl rand -base64 48) npm start
```

The demo database lives in `EDUQUEST_DATA_DIR` (default `./.data`) and must be on a **persistent, writable disk** (a VM, container volume, Railway/Render/Fly volume). Serverless platforms such as Vercel have an ephemeral, per-instance filesystem: the demo will run there, but data resets and is not shared between instances. Use the production backend for real deployments.

## Persistent hosting (recommended today)

`Dockerfile` + `render.yaml` run the app on a host with a persistent disk mounted at `/data` (`EDUQUEST_DATA_DIR=/data`). See the README. Set `ALLOW_DEMO_RESET=off` so the public demo can't be wiped, and back up the disk (Render takes daily disk snapshots). The Supabase path below is the long-term option for many schools; it needs the domain layer moved from synchronous SQLite calls to an async PostgreSQL client.

## Production backend (Supabase), what's ready and what's left

Ready in this repository:

- `supabase/migrations/0001_schema.sql`: full relational schema, with `users.auth_user_id` linking to Supabase Auth
- `0002_rls.sql`: row-level security policies mirroring the domain authorization rules
- `0003_functions.sql`: atomic `eq_redeem_offer` and the retention purge function

> These migrations were generated from the demo schema but **have not yet been executed against a PostgreSQL instance in this build**. Run them on a staging project first (`supabase db push`) and fix any dialect issues.

Still to implement before go-live (see `FEATURE_STATUS.md`):

1. A PostgreSQL implementation of the `Db` wrapper (or a repository layer) using the service-role key on the server; the domain functions are written against portable SQL with `?` placeholders.
2. Supabase Auth sign-in (email magic link or school SSO via SAML/OIDC) replacing the demo picker, mapping `auth.users.id` → `users.auth_user_id`.
3. A private Supabase Storage bucket implementing `putObject`/`getObject` (`src/lib/documents/storage.ts`).
4. Schedule `eq_purge_expired_support_records()` daily (pg_cron) and support-indicator detection (e.g. nightly).

## Environment

See `.env.example`. Required in production: `EDUQUEST_MODE=production`, `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Optional: `AI_API_KEY` (cloud AI, Groq by default), `AI_BASE_URL`, `AI_MODEL`, `AI_BROWSER`, `AI_SIMULATION`, `AI_DAILY_REQUEST_LIMIT`, `MAX_UPLOAD_MB`.

## Health check

`GET /api/health` returns `{status, mode, ai, database}` with no secrets.

## PWA

`/manifest.webmanifest` and generated icons make the app installable from supported browsers (start URL `/app`). There is no offline cache yet.
