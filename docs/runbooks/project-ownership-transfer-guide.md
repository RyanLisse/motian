# Project Ownership Transfer Guide

> This English guide and `project-ownership-transfer-guide.nl.md` should stay functionally equivalent. If one changes, update the other in the same edit.

## 1. Project Summary

### What Motian does

Motian is an AI-assisted recruitment operations platform focused on the Dutch public-sector staffing market. It collects vacancies from multiple platforms, normalizes and enriches them, generates embeddings, and supports recruiter workflows for candidate intake, matching, messaging, interviews, and reporting.

### Who it serves

- Recruiters and staffing operators working in the Dutch market
- Internal operators maintaining scraping, matching, and candidate workflows
- AI-assisted surfaces consuming the same service layer: chat, MCP, CLI, and voice

### Business-critical flows

- Vacancy ingestion from external platforms into the shared jobs dataset
- Candidate intake and CV analysis
- Hybrid search across vacancies and candidates
- AI-assisted matching and recruiter review
- Scheduled cleanup, retention, and scraper health jobs
- Operational visibility through Vercel, Trigger.dev, Sentry, and PostHog

### What healthy operation looks like

- The app loads and key routes are reachable: `/vacatures`, `/kandidaten`, `/chat`, `/scraper`
- `/api/gezondheid` responds successfully
- Trigger.dev scheduled tasks are visible and recent runs are healthy
- Scrapers are importing new jobs and circuit breakers are not stuck open
- Search remains responsive and fallback behavior is understood if Typesense is disabled
- Sentry is receiving errors and Vercel deployments can be rolled back quickly

## 2. System Map

| Area | What it does | Key references |
| --- | --- | --- |
| Next.js app | Main product UI and API routes | `README.md`, `docs/architecture.md` |
| Neon PostgreSQL | Source of truth for jobs, candidates, matches, applications, interviews, messages, scraper config, scrape results, GDPR audit | `src/db/schema.ts`, `src/db/index.ts`, `docs/architecture.md` |
| Scrapers | Pull data from Striive, Flextender, and Opdrachtoverheid | `src/services/scrapers/`, `docs/architecture.md`, `docs/runbooks/platform-onboarding.md` |
| Trigger.dev | Scheduled jobs for scrape orchestration, embeddings, retention, health checks, and staleness cleanup | `trigger/`, `trigger.config.ts`, `docs/architecture.md` |
| AI chat / MCP / CLI / voice | Multiple agent surfaces over the same domain services | `src/ai/`, `src/mcp/`, `src/voice-agent/`, `src/cli/`, `docs/architecture.md` |
| Typesense (optional) | External search accelerator for jobs and candidates, with PostgreSQL still the source of truth | `README.md`, `.env.example` |
| Salesforce feed | Read-only XML export for Salesforce pull integrations | `app/api/salesforce-feed/route.ts`, `src/services/salesforce-feed.ts`, `docs/architecture.md` |
| Autopilot | Browser-based audit evidence and operational validation tooling | `docs/autopilot-usage.md`, `docs/autopilot-configuration.md` |

## 3. Ownership Domains

### 3.1 Application and runtime

The owner is responsible for the health of the main web app, API routes, and the shared service layer behind all agent surfaces.

- Keep frontend route conventions stable: Dutch UI labels, English code variables, Dutch API paths
- Know the canonical user-facing routes: `/vacatures` and `/kandidaten`
- Use `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm test`, and `pnpm exec tsc --noEmit` as baseline validation
- Treat `docs/architecture.md` as the fastest high-level map of the running system

### 3.2 Deployments and rollback

Production runs on Vercel.

- Vercel project name: `motian`
- Vercel project metadata currently checked into `.vercel/project.json`
  - `projectId`: `prj_hxmxjdF2WhabGU4qc29KOCR4Y4g6`
  - `orgId`: `team_ouqYH7cF2UfVWN6dDhryMSEM`
- Use `docs/deployment-verification-summary.md` as the main rollback-oriented reference
- Rollback expectation: fast Vercel promote/rollback path with minimal operational delay
- The new owner should be able to identify production, preview, and the previous good deployment without assistance

### 3.3 Database and data retention

Neon PostgreSQL is the source of truth.

- Review schema shape in `src/db/schema.ts`
- Understand soft-delete and retention behavior before making data changes
- Retention and cleanup are part of project ownership, not a side concern
- GDPR and audit expectations are part of normal operations, especially around candidates and retention cleanup

### 3.4 Scraping operations and platform onboarding

Scraping is central to product value and one of the highest-risk ownership domains.

- Existing platforms include Striive, Flextender, and Opdrachtoverheid
- Use `docs/runbooks/platform-onboarding.md` for shared onboarding flow and recovery states
- Treat scraper failures, consent walls, auth drift, anti-bot changes, and empty imports as operational incidents
- Activation is not complete until a platform has a successful run and future schedules remain healthy
- Modal, Browserbase, Firecrawl, and platform credentials are all part of the ownership surface

### 3.5 Monitoring and incident response

The owner is responsible for both user-visible reliability and operator visibility.

- SLO and observability guidance lives in `docs/slo-and-observability.md`
- Sentry is the main error and release visibility surface
- PostHog covers product analytics
- Vercel covers deployment, runtime, and Speed Insights visibility
- Trigger.dev covers scheduled task execution and failures
- Incidents should be triaged with logs, recent deploy history, task runs, and affected provider status together

### 3.6 Vendors and accounts

The owner must know not only which providers exist, but which ones are required for normal operation versus optional acceleration.

- Required core vendors: GitHub, Vercel, Neon, Trigger.dev
- Required AI/runtime vendors for full feature set: OpenAI, Google AI, xAI
- Optional or situational vendors: Anthropic, Typesense, Browserbase, Modal, Firecrawl, LiveKit, LangSmith, Slack, PostHog, Sentry
- Billing visibility is part of ownership, especially for AI-provider costs and usage spikes

### 3.7 Security and secrets

Secrets must not be copied into repo documentation.

- Use `.env.example` as the inventory of secret families, not the source of truth for real values
- Current repo guidance implies local development uses `.env.local`
- Comments in `.env.example` indicate some local values are refreshed from Vercel via `vercel env pull .env.local`
- Trigger.dev also syncs selected env vars from runtime config in `trigger.config.ts`
- Record the actual secret source of truth during handoff outside the repo if needed
- Rotate high-risk secrets after transfer where practical, especially for provider tokens with write access

## 4. Operational Commands

| Command | Purpose | When the owner should use it |
| --- | --- | --- |
| `pnpm dev` | Run the main app locally | Local debugging and product walkthroughs |
| `pnpm lint` | Biome lint check | Before commits and after changes |
| `pnpm test` | Vitest suite | Baseline regression check |
| `pnpm build` | Production build validation | Before shipping risky changes |
| `pnpm exec tsc --noEmit` | TypeScript validation | Before merge and during transfer validation |
| `pnpm harness:pre-pr` | Combined lint, typecheck, test, and risk gate | Pre-PR quality gate |
| `pnpm harness:smoke` | Smoke-level harness validation | First-week ownership checks |
| `pnpm harness:entropy` | Entropy and cleanup check | Quality control before handoff closeout |
| `pnpm mcp` | Run the MCP server | Validate agent integrations |
| `pnpm cli` | Run the CLI agent | Validate operational parity |
| `pnpm voice-agent:dev` | Run the voice agent in development | Voice surface validation when enabled |

## 5. Access and Vendor Inventory

| Provider | Why it exists | Access the new owner should have | Where to verify |
| --- | --- | --- | --- |
| GitHub | Source control, PRs, CI workflow visibility | Repo admin or equivalent maintainer access | Repository settings, branch protections, CI runs |
| Vercel | Production and preview deployments | Project/team access with deploy and rollback rights | `.vercel/project.json`, Vercel dashboard |
| Neon | Primary database | Project access with read/write operational visibility | Neon console, schema and query visibility |
| Trigger.dev | Scheduled jobs and long-running tasks | Project access to runs, schedules, env, and logs | `trigger.config.ts`, Trigger.dev dashboard |
| Sentry | Error tracking and release visibility | Project access plus release visibility | Sentry project dashboard |
| PostHog | Product analytics and usage signals | Project access | PostHog dashboard |
| LiveKit | Voice runtime, if enabled | Project access for runtime and credentials | LiveKit dashboard, `.env.example` |
| Typesense | Optional search acceleration | Access if external indexing is enabled | `.env.example`, reindex workflow |
| Browserbase | Browser automation for authenticated scraping | Credential access if platform scraping relies on it | `.env.example` |
| Modal | Sandbox execution for scraping on Vercel | Credential access if Striive or similar scraping depends on it | `.env.example` |
| Firecrawl | Public-web scraping and extraction | Credential access if enabled | `.env.example` |
| OpenAI | Embeddings and chat model access | Billing and API access visibility | `.env.example`, provider dashboard |
| Google AI | CV parsing, enrichment, structured matching, voice plugin usage | Billing and API access visibility | `.env.example`, provider dashboard |
| xAI | Judge model | Billing and API access visibility | `.env.example`, provider dashboard |
| Anthropic | Present in env inventory for AI SDK use | Billing and API access visibility if still used operationally | `.env.example`, provider dashboard |
| LangSmith | Optional tracing/observability | Project access if tracing is enabled | `.env.example` |
| Slack | Notifications and operational messaging | Workspace/app token ownership if used | `.env.example`, Slack app config |

## 6. Environment Contract

| Subsystem | Key env families | Expected source of truth | Notes |
| --- | --- | --- | --- |
| Database | `DATABASE_URL` | Hosted env plus local `.env.local` | Required for app and Trigger.dev |
| App auth and API exposure | `API_SECRET`, `ALLOWED_ORIGINS` | Hosted env | Shared `/api/*` bearer behavior matters operationally |
| Search | `TYPESENSE_*` | Hosted env when enabled | Optional accelerator, PostgreSQL remains source of truth |
| Encryption | `ENCRYPTION_SECRET` | Hosted env and secure local development storage | Needed for encrypted scraper auth config; rename legacy `ENCRYPTION_KEY` if present |
| Scraping providers | `BROWSERBASE_*`, `FIRECRAWL_API_KEY`, `MODAL_*`, platform credentials | Secure provider secrets store | High-risk ownership area |
| AI provider gateway | `OPENROUTER_API_KEY` | OpenRouter project secret in hosted env | Single billing/key surface for app chat, enrichment, embeddings, and voice LLM routing |
| Monitoring | `SENTRY_*`, `LANGSMITH_*`, `OTEL_ENABLED`, `NEXT_PUBLIC_POSTHOG_*` | Hosted env | Confirm these match the active dashboards |
| Voice | `LIVEKIT_*`, `NEXT_PUBLIC_LIVEKIT_URL` | Hosted env | Required only if voice surface is active |
| Notifications | `SLACK_*` | Hosted env | Optional, but operationally important when enabled |
| Autopilot | `AUTOPILOT_*` | Hosted env plus local debug setup | Used for evidence capture and operational audits |

## 7. Runbooks and Escalation

| Scenario | First checks | Primary references | Escalate when |
| --- | --- | --- | --- |
| Deployment failure or bad release | Inspect latest deploy, compare with previous good deploy, check runtime logs, confirm rollback path | `docs/deployment-verification-summary.md` | Production health is degraded or rollback is blocked |
| Scraper failure or empty imports | Check scraper config status, recent scrape results, auth/provider status, and circuit breaker state | `docs/runbooks/platform-onboarding.md`, `docs/architecture.md` | A platform stays broken across scheduled runs or auth/provider access is unclear |
| Trigger.dev task failure | Inspect failing run, recent schedule history, synced env, and related provider dependencies | `trigger.config.ts`, `docs/architecture.md` | Scheduled jobs are repeatedly failing or retention/scrape jobs are stuck |
| Search or index degradation | Check whether Typesense is enabled, compare fallback behavior, inspect response times and logs | `README.md`, `docs/slo-and-observability.md` | Search quality or latency materially impacts recruiter workflows |
| Sentry or PostHog anomaly | Inspect recent deploys, new issues, user-impact patterns, and provider configuration drift | `docs/slo-and-observability.md`, `docs/deployment-verification-summary.md` | There is a new critical error class or unexplained usage drop |

## 8. Current Risks and First Priorities

The incoming owner should start with the currently known high-priority risks rather than a blank roadmap.

- `motian-n38`: Modal scraping stub blocks a complete Vercel-safe path for Striive-style flows
- `motian-scy`: scoring is still too rule-based and needs stronger semantic/vector matching
- `motian-o5g`: pagination coverage is still incomplete on some surfaces, even though core recruiter views already paginate
- `motian-uml`: cron due checks now respect per-platform `cronExpression`; the remaining risk is schedule observability and coverage drift
- Scraper reliability remains a standing operational concern, especially where auth, browser automation, or provider markup changes are involved
- Platform onboarding remains a critical operator workflow, not a one-time setup task

Additional context to preserve during handoff:

- Dutch UI strings and Dutch API paths are intentional product conventions
- Code variables remain English even when user-facing copy is Dutch
- The repo still contains historical route and naming context; the current preferred user-facing routes are `/vacatures` and `/kandidaten`

## 9. Transfer Execution Notes

Use `project-ownership-transfer-checklist.md` to execute the live transfer. This guide is the reference document; the checklist is the operational proof that the handoff was actually completed.

Record outside the repo if needed:

- current technical owner
- incoming technical owner
- fallback operator or stakeholder
- billing owners per provider
- secret-management source of truth
- date of access revocation for the previous owner
