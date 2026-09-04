# Deployment verification summary

This is the current handoff verification runbook for Motian. It replaces older dated deployment notes so the customer has one source of truth.

## Production surfaces

- App: `https://motian.vercel.app`
- Health endpoint: `GET /api/gezondheid`
- Salesforce feed: `GET /api/salesforce-feed`
- Trigger.dev project: `proj_nqihauooanbnqnbpoybp`
- Vercel project: `motian`

## Local pre-push gates

Run these before handing off or pushing a production change:

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm tsx scripts/harness/entropy-check.ts
SKIP_ENV_VALIDATION=1 pnpm build
```

Use `SKIP_ENV_VALIDATION=1 pnpm build` only when the local checkout intentionally has no `.env.local`. Hosted CI/Vercel must use real environment variables.

## Production deploy checks

After a merge to `main` and Vercel deploy:

```bash
curl -fsS https://motian.vercel.app/api/gezondheid
curl -fsS "https://motian.vercel.app/api/salesforce-feed?entity=jobs&limit=5"
```

If Trigger.dev tasks were changed, deploy them separately:

```bash
set -a && source .env.local && set +a
pnpm dlx trigger.dev deploy
```

Then verify in Trigger.dev:

1. `scrape-pipeline` and `scraper-health-check` are present in the latest deployment.
2. The next scheduled run is visible.
3. Recent scraper runs are either successful or linked to an explicit incident ticket.
4. No platform is stuck on `circuit_breaker_open` without an owner.

## Required hosted secrets

The exact secret values must live outside the repository. Minimum production set:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED` when used by database tooling
- `OPENROUTER_API_KEY` (unified AI gateway key)
- `TRIGGER_SECRET_KEY`
- `BROWSERBASE_API_KEY`
- `BROWSERBASE_PROJECT_ID`
- `FIRECRAWL_API_KEY`
- `SENTRY_AUTH_TOKEN` when sourcemaps are uploaded
- `API_SECRET` for protected external API routes

See [Vercel Environment Variable Inventory](rjc-420-vercel-env-inventory.md) for the complete production, preview, and build-time variable matrix.

## Handoff sign-off criteria

- GitHub `main` is clean and pushed.
- Vercel production deploy is healthy.
- Trigger.dev schedules and logs are accessible to the customer.
- Neon backups/snapshots are documented outside the repo.
- Sentry/PostHog dashboards are accessible.
- `/vacatures`, `/kandidaten`, `/chat`, `/scraper`, and `/overzicht` are smoke-tested.
