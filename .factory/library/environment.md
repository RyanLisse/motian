# Environment

Environment variables, external dependencies, and setup notes for the performance mission.

**What belongs here:** required env vars, external service dependencies, local setup notes, validation prerequisites.  
**What does not belong here:** service start/stop commands and ports (use `.factory/services.yaml`).

---

## Required runtime configuration

- `.env.local` must exist before any worker starts runtime validation.
- The app uses **Neon PostgreSQL** as the source of truth through environment variables.
- At least one of the following must be present in `.env.local`:
  - `DATABASE_URL`
  - `DATABASE_URL_UNPOOLED`
- `ENCRYPTION_SECRET` (min 32 chars) is required when encrypted scraper auth config is in use; canonical name in `src/env.ts`. Rename legacy `ENCRYPTION_KEY` if your host still uses that name.

## Validation-related dependencies

- `vercel env pull .env.local --yes` is the approved way to refresh local env values when needed.
- Search/database benchmarks read `.env.local` directly and must run against the configured Neon database.
- Typesense is optional for the product surface; search validation must still preserve recruiter-facing behavior when the app falls back to Postgres-backed retrieval.

## Safety rules

- Never print or commit secret values from `.env.local`.
- Never rewrite `.env.local` except through approved env pull or clearly scoped local boot-fix work.
- If runtime validation fails because required env vars are missing or malformed, return to the orchestrator with the exact missing key names only.
