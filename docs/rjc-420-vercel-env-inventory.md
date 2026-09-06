# Motian M0 (RJC-420): Vercel Environment Variable Inventory

> **Security Notice:** This document contains **environment variable names only**. No secret values, credentials, API keys, tokens, or connection strings are stored here or in version control. All secret values must be managed directly in the Vercel Dashboard (`Project Settings > Environment Variables`) and synced locally via `vercel env pull .env.local`.

---

## 1. Overview & Verification Context

- **Issue:** [RJC-420](https://linear.app/rcjt-studio/issue/RJC-420) — Motian M0 Vercel Environment Variable Inventory
- **Application:** `https://motian.vercel.app`
- **Vercel Project Name:** `motian`
- **Framework:** Next.js 16 (App Router with Turbopack, standalone server components, BFF architecture)
- **Type Schema:** Enforced via `@t3-oss/env-nextjs` in `src/env.ts` and runtime validation in `src/lib/runtime-config.ts`

---

## 2. Inventory Matrix

| Variable Name | Scope | Production Status | Feature / Domain | Validation Authority |
|---|---|---|---|---|
| `DATABASE_URL` | Server | **Required** | Neon PostgreSQL (Pooled) | `src/env.ts`, `packages/db` |
| `DATABASE_URL_UNPOOLED` | Server / Build | Optional (Direct) | Neon PostgreSQL (Migrations) | `drizzle.config.ts` |
| `API_SECRET` | Server | **Required in Prod** | BFF & Protected API Routes | `src/lib/runtime-config.ts` |
| `OPENROUTER_API_KEY` | Server | **Required for AI** | Unified AI Gateway (Chat, Embeddings) | `src/env.ts` |
| `SENTRY_DSN` | Server | **Recommended** | Error Tracking (Server & Edge) | `src/env.ts`, `next.config.ts` |
| `NEXT_PUBLIC_SENTRY_DSN` | Client | **Recommended** | Error Tracking (Browser) | `src/env.ts`, `next.config.ts` |
| `SENTRY_AUTH_TOKEN` | Build | **Required in Prod Build** | Sentry Sourcemap Upload | `next.config.ts` |
| `SENTRY_ORG` | Build / Server | Optional (Defaults) | Sentry Organization Slug | `src/env.ts`, `next.config.ts` |
| `SENTRY_PROJECT` | Build / Server | Optional (Defaults) | Sentry Project Slug | `src/env.ts`, `next.config.ts` |
| `BLOB_READ_WRITE_TOKEN` | Server | Optional (CVs) | Vercel Blob File Storage | `src/env.ts` |
| `BROWSERBASE_API_KEY` | Server | Required for Scrapers | Headless Browser Automation | `src/env.ts`, `trigger.config.ts` |
| `BROWSERBASE_PROJECT_ID` | Server | Required for Scrapers | Browserbase Project ID | `src/env.ts`, `trigger.config.ts` |
| `FIRECRAWL_API_KEY` | Server | Required for Scrapers | Web Scraping Extraction | `src/env.ts`, `trigger.config.ts` |
| `LIVEKIT_URL` | Server | Optional (Voice) | Voice Agent WebSocket (Internal) | `src/env.ts`, `src/lib/runtime-config.ts` |
| `NEXT_PUBLIC_LIVEKIT_URL` | Client | Optional (Voice) | Voice Agent WebSocket (Client) | `src/env.ts`, `src/lib/runtime-config.ts` |
| `LIVEKIT_API_KEY` | Server | Optional (Voice) | Voice Agent Authentication | `src/env.ts`, `src/lib/runtime-config.ts` |
| `LIVEKIT_API_SECRET` | Server | Optional (Voice) | Voice Agent Authentication | `src/env.ts`, `src/lib/runtime-config.ts` |
| `NEXT_PUBLIC_POSTHOG_KEY` | Client | Optional | Product Analytics | `src/env.ts` |
| `NEXT_PUBLIC_POSTHOG_HOST` | Client | Optional | PostHog EU Host URL | `src/env.ts` |
| `ENCRYPTION_SECRET` | Server | Optional | AES-256 Platform Auth Config | `src/env.ts`, `src/lib/crypto.ts` |
| `CRON_SECRET` | Server | Optional | Vercel Cron Endpoint Protection | `src/env.ts` |
| `ALLOWED_ORIGINS` | Server | Optional | CORS Allowlist (`proxy.ts`) | `src/env.ts`, `proxy.ts` |
| `UPSTASH_REDIS_REST_URL` | Server | Optional | Distributed Cache | `src/env.ts` |
| `UPSTASH_REDIS_REST_TOKEN` | Server | Optional | Distributed Cache Auth | `src/env.ts` |
| `TRIGGER_SECRET_KEY` | Server | Required for Trigger | Trigger.dev Task Execution | `trigger.config.ts` |
| `MODAL_TOKEN_ID` | Server | Optional | Modal Python Sandbox | `src/env.ts`, `trigger.config.ts` |
| `MODAL_TOKEN_SECRET` | Server | Optional | Modal Python Sandbox | `src/env.ts`, `trigger.config.ts` |
| `STRIIVE_USERNAME` | Server | Optional | Platform Scraper Credential | `src/env.ts`, `trigger.config.ts` |
| `STRIIVE_PASSWORD` | Server | Optional | Platform Scraper Credential | `src/env.ts`, `trigger.config.ts` |
| `STRIIVE_SESSION_COOKIE` | Server | Optional | Platform Session Override | `src/env.ts` |
| `STRIIVE_USE_MODAL` | Server | Optional | Sandbox Routing Flag | `src/env.ts` |
| `AUTOPILOT_BASE_URL` | Server | Optional | Autopilot Browser Container | `src/env.ts`, `trigger.config.ts` |
| `AUTOPILOT_GITHUB_TOKEN` | Server | Optional | Autopilot Issue/PR Tracking | `src/env.ts`, `trigger.config.ts` |
| `AUTOPILOT_EVIDENCE_DIR` | Server | Optional | Autopilot Artifact Store | `src/env.ts`, `trigger.config.ts` |
| `AUTOPILOT_RICH_EVIDENCE` | Server | Optional | Failure Capture Mode | `src/env.ts`, `trigger.config.ts` |
| `LANGSMITH_TRACING` | Server | Optional | AI Pipeline Tracing Flag | `src/env.ts` |
| `LANGSMITH_API_KEY` | Server | Optional | LangSmith Tracing API Key | `src/env.ts` |
| `LANGSMITH_PROJECT` | Server | Optional | LangSmith Project Name | `src/env.ts` |
| `OTEL_ENABLED` | Server | Optional | OpenTelemetry AI Tracing | `src/env.ts` |
| `SLACK_BOT_TOKEN` | Server | Optional | Recruiter Slack Bot | `src/env.ts` |
| `SLACK_CHANNEL_ID` | Server | Optional | Recruiter Alerts Channel | `src/env.ts` |
| `WHATSAPP_ENABLED` | Server | Optional | WhatsApp Integration Flag | `src/env.ts` |
| `WHATSAPP_AUTH_DIR` | Server | Optional | Baileys Session Storage Dir | `src/env.ts` |
| `WHATSAPP_RATE_LIMIT` | Server | Optional | Outbound Message Rate Limit | `src/env.ts` |
| `MARKDOWN_FAST_URL` | Server | Optional | High-Perf Markdown Renderer | `src/env.ts` |
| `MARKDOWN_FAST_TOKEN` | Server | Optional | Markdown Fast Service Auth | `src/env.ts` |
| `RESEND_API_KEY` | Server | Optional (Trigger) | Transactional Email Service | `trigger/agent-communicator.ts` |
| `RESEND_FROM_EMAIL` | Server | Optional (Trigger) | Outbound Email Address | `trigger/agent-communicator.ts` |

---

## 3. Detailed Inventory by Domain

### 3.1 Database & Storage

#### `DATABASE_URL`
- **Scope:** Server-only
- **Requirement:** **Mandatory** in all environments (Production, Preview, Development)
- **Description:** PostgreSQL pooled connection string for Neon serverless database.
- **Consumption:** `packages/db/src/index.ts`, Drizzle ORM query runner, and Next.js server actions.
- **Guard:** Throw occurs at application boot via `src/env.ts` and `validateRuntimeEnv()` if missing.

#### `DATABASE_URL_UNPOOLED`
- **Scope:** Server / Tooling
- **Requirement:** Optional in Vercel runtime; required for direct Drizzle migrations and schema push scripts.
- **Description:** Direct (non-pooled) Neon connection string bypassing the pgbouncer pooler.

#### `NEXT_PUBLIC_DATABASE_URL`
- **Scope:** Forbidden / Security Anti-pattern
- **Status:** **FORBIDDEN**. Guarded by `packages/db/src/index.ts` (`assertNoPublicDatabaseUrl`) and tested in `tests/db-env-guard.test.ts`. Setting this variable will deliberately throw to prevent leaking database credentials into client bundles.
- **Deploy audit:** [`docs/runbooks/next-public-database-url-deploy-audit.md`](runbooks/next-public-database-url-deploy-audit.md) — verify the name is **absent** on Vercel Motian, Coolify Motian, and Trigger.dev Motian (names only, never values).

#### `BLOB_READ_WRITE_TOKEN`
- **Scope:** Server-only
- **Requirement:** Required if CV document uploads and storage features are enabled.
- **Description:** Token for Vercel Blob store, managed via Vercel Storage integration.

---

### 3.2 Security, BFF & API Trust Boundary

#### `API_SECRET`
- **Scope:** Server-only
- **Requirement:** **Mandatory in Production** (`VERCEL_ENV=production`)
- **Description:** Shared secret for authenticating requests to protected internal `/api` routes (CV processing, scrapers, reporting).
- **Architecture:** Per RJC-419 / PR #249, browser clients must communicate via the Backend-for-Frontend (BFF) proxy at `/bff`, which attaches `Authorization: Bearer <API_SECRET>` server-side.
- **Guard:** `validateRuntimeEnv()` returns a blocking error in production if `API_SECRET` is unset.

#### `ALLOWED_ORIGINS`
- **Scope:** Server-only
- **Requirement:** Optional (Defaults to `http://localhost:3001,http://127.0.0.1:3001`)
- **Description:** Comma-separated list of allowed CORS origins enforced in `proxy.ts`.

#### `CRON_SECRET`
- **Scope:** Server-only
- **Requirement:** Optional
- **Description:** Bearer secret used by Vercel Cron to invoke `/api/cron/*` endpoints securely.

#### `ENCRYPTION_SECRET`
- **Scope:** Server-only
- **Requirement:** Optional (Required when platform authentication configs are encrypted at rest)
- **Description:** Minimum 32-character AES secret key consumed by `src/lib/crypto.ts` and `scripts/encrypt-auth-configs.ts`.

---

### 3.3 AI Gateway (OpenRouter)

#### `OPENROUTER_API_KEY`
- **Scope:** Server-only
- **Requirement:** Required for all AI operations (chat, matching, enrichment, vacancy embeddings).
- **Architecture:** Motian uses OpenRouter as the single, unified AI gateway (`sk-or-v1-...`).
- **Legacy Replacement:** Fully replaces legacy direct provider keys (`OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`), which were deprecated and removed.

---

### 3.4 Observability, Error Tracking & Analytics

#### `SENTRY_DSN`
- **Scope:** Server / Edge
- **Requirement:** Recommended for production monitoring.
- **Description:** Ingestion DSN for Sentry Node/Edge SDK.

#### `NEXT_PUBLIC_SENTRY_DSN`
- **Scope:** Client (Public)
- **Requirement:** Recommended for production client-side error capture.
- **Description:** Public Sentry DSN loaded in browser bundles via `instrumentation-client.ts`.

#### `SENTRY_AUTH_TOKEN`
- **Scope:** Build-time only
- **Requirement:** **Mandatory for production builds** on Vercel when Sentry DSN is configured.
- **Description:** Authentication token granting `project:releases` and `org:read` permissions for uploading sourcemaps during `next build`.
- **Guard:** `next.config.ts:16` throws if `NODE_ENV === "production"`, Sentry is configured, and `SENTRY_AUTH_TOKEN` is missing.

#### `SENTRY_ORG` & `SENTRY_PROJECT`
- **Scope:** Build / Server
- **Requirement:** Optional (Defaults in `next.config.ts`: `org: "ryan-lisse-bv"`, `project: "motian"`).

#### `NEXT_PUBLIC_POSTHOG_KEY` & `NEXT_PUBLIC_POSTHOG_HOST`
- **Scope:** Client (Public)
- **Requirement:** Optional
- **Description:** PostHog project API key and ingest host (e.g. `https://eu.i.posthog.com`) for UI analytics.

#### `LANGSMITH_TRACING`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`
- **Scope:** Server-only
- **Requirement:** Optional
- **Description:** AI pipeline tracing configuration via LangSmith (`LANGSMITH_TRACING`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`).

#### `OTEL_ENABLED`
- **Scope:** Server-only
- **Requirement:** Optional
- **Description:** Enables OpenTelemetry tracing integration for Vercel AI SDK.

---

### 3.5 Voice Agent (LiveKit)

#### `LIVEKIT_URL`, `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- **Scope:** Split Server/Client
- **Requirement:** **All-or-nothing requirement**.
- **Description:** LiveKit WebSocket URLs and API credentials for candidate voice screening sessions.
- **Guard:** `validateRuntimeEnv()` enforces that if ANY LiveKit variable is defined, ALL four must be set.

---

### 3.6 Scraping Infrastructure (Browserbase, Firecrawl, Modal)

#### `BROWSERBASE_API_KEY` & `BROWSERBASE_PROJECT_ID`
- **Scope:** Server-only
- **Requirement:** Required for dynamic job board scrapers (MiPublic, Striive fallback).
- **Guard:** Enforced at deploy time by `trigger.config.ts`.

#### `FIRECRAWL_API_KEY`
- **Scope:** Server-only
- **Requirement:** Required for public job board scrapers.
- **Guard:** Enforced at deploy time by `trigger.config.ts`.

#### `MODAL_TOKEN_ID` & `MODAL_TOKEN_SECRET`
- **Scope:** Server-only
- **Requirement:** Optional (Used when running Playwright scrapers in Modal sandboxes from Vercel).

#### `STRIIVE_USERNAME`, `STRIIVE_PASSWORD`, `STRIIVE_SESSION_COOKIE`, `STRIIVE_USE_MODAL`, `STRIIVE_LIMIT`, `STRIIVE_MAX_PAGES`
- **Scope:** Server-only
- **Requirement:** Optional (Platform credentials and scraper pagination tuning).

---

### 3.7 Background Workers & Notifications

#### `TRIGGER_SECRET_KEY`
- **Scope:** Server / Deploy
- **Requirement:** Required for Trigger.dev worker tasks (`proj_nqihauooanbnqnbpoybp`).

#### `RESEND_API_KEY` & `RESEND_FROM_EMAIL`
- **Scope:** Server-only
- **Requirement:** Optional (Transactional emails for candidate communication in Trigger tasks).

#### `SLACK_BOT_TOKEN` & `SLACK_CHANNEL_ID`
- **Scope:** Server-only
- **Requirement:** Optional (Slack webhook / bot alerts for recruiter actions).

#### `WHATSAPP_ENABLED`, `WHATSAPP_AUTH_DIR`, `WHATSAPP_RATE_LIMIT`
- **Scope:** Server-only
- **Requirement:** Optional (WhatsApp candidate engagement channel).

---

### 3.8 Performance, Caching & Search Tuning

#### `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`
- **Scope:** Server-only
- **Requirement:** Optional (Distributed cache for API responses and scraper locks).

#### `MARKDOWN_FAST_URL` & `MARKDOWN_FAST_TOKEN`
- **Scope:** Server-only
- **Requirement:** Optional (Dedicated microservice for markdown rendering).

#### Scoring & Matching Weights (Numeric Configs)
- `SCORING_WEIGHT_SKILLS` (Default: 40)
- `SCORING_WEIGHT_LOCATION` (Default: 20)
- `SCORING_WEIGHT_RATE` (Default: 20)
- `SCORING_WEIGHT_ROLE` (Default: 20)
- `HYBRID_BLEND_RULE` (Default: 0.6)
- `HYBRID_BLEND_VECTOR` (Default: 0.4)
- `RECENCY_BOOST_DAYS` (Default: 30)
- `RECENCY_PENALTY_DAYS` (Default: 60)
- `RECENCY_BOOST_AMOUNT` (Default: 5)
- `RECENCY_PENALTY_AMOUNT` (Default: 5)
- `QUALITY_SIGNAL_DECAY_DAYS` (Default: 90)
- `QUALITY_HIGH_APPROVAL_THRESHOLD` (Default: 70)
- `QUALITY_LOW_APPROVAL_THRESHOLD` (Default: 30)
- `QUALITY_HIGH_APPROVAL_BOOST` (Default: 5)
- `QUALITY_LOW_APPROVAL_PENALTY` (Default: 5)
- `QUALITY_MIN_DECISIONS` (Default: 3)
- `RATE_CAP_EUR`
- `CHAT_MAX_TOKENS_PER_SESSION`
- `HYBRID_SEARCH_ALLOW_SHORT_VECTOR`
- `HYBRID_SEARCH_PAGE_ONLY_HYDRATION`

#### ESCO Classification
- `ESCO_VERSION`
- `ESCO_CRITICAL_REVIEW_THRESHOLD`
- `ESCO_SCORING_ENABLED`

---

### 3.9 Vercel System & Deployment Variables (Auto-Injected)

These variables are automatically injected by the Vercel deployment pipeline and must **never** be manually overridden:

| Variable | Type / Values | Injected By | Usage in Motian |
|---|---|---|---|
| `VERCEL` | `"1"` | Vercel Platform | Detects execution inside Vercel serverless functions |
| `VERCEL_ENV` | `"production" \| "preview" \| "development"` | Vercel Platform | Environment tier detection (`isProductionEnvironment()`) |
| `VERCEL_URL` | String (Domain) | Vercel Platform | Current deployment URL (without scheme) |
| `VERCEL_GIT_COMMIT_SHA` | String (Hex 40) | Vercel Platform | Git commit SHA of the current build |
| `NODE_ENV` | `"production" \| "development" \| "test"` | Node / Next.js | Standard Node runtime environment |

---

### 3.9b Vercel-only — Deployment Protection

| Variable | Sources | Notes |
|---|---|---|
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Vercel Dashboard (Deployment Protection) | **Vercel-only.** Use for CI/curl smoke tests when Deployment Protection is enabled. Never commit the value. Not present in `.env.example`. |
| `NEXT_PUBLIC_VERCEL_ENV` | Code (occasional) | Client-visible env tier if referenced |
| `NEXT_RUNTIME` | Next.js | Runtime marker |

Public app / Motia URL names (also see `.env.example`): `NEXT_URL`, `PUBLIC_API_BASE_URL`, `MOTIA_API_URL`, `HOSTNAME`, `PORT`, `BASE_URL`.

Scraper platform extras from `.env.example`: `LINKEDIN_USERNAME`, `LINKEDIN_PASSWORD`.

Encryption env name is aligned: `.env.example` and `src/env.ts` both use `ENCRYPTION_SECRET`. Hosts still on legacy `ENCRYPTION_KEY` must rename (value unchanged).

**Live `vercel env ls`:** not pulled on `motian.exe.xyz` at inventory time (`vercel` CLI missing/unauthenticated). Re-run names-only listing when authenticated and diff against this matrix.


### 3.10 Build & Verification Switches

| Variable | Allowed Values | Usage |
|---|---|---|
| `SKIP_ENV_VALIDATION` | `"1"` or `"true"` | Bypasses `t3-env` schema checks during Docker builds or CI typecheck without secrets |
| `ANALYZE` | `"true"` | Triggers `@next/bundle-analyzer` client/server bundle inspection |

---

## 4. Deprecated, Removed & Legacy Variables

The following variables appeared in earlier iterations of Motian but have been decommissioned or replaced:

1. **Direct AI Provider Keys** (`OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`):
   - **Replaced by:** `OPENROUTER_API_KEY` per PR #242.
   - **Status:** Ignored; do not set in Vercel.

2. **Typesense Search Index** (`TYPESENSE_URL`, `TYPESENSE_API_KEY`, `TYPESENSE_JOBS_COLLECTION`, `TYPESENSE_CANDIDATES_COLLECTION`):
   - **Status:** Optional/decoupled. Production search operates natively on Neon PostgreSQL hybrid search.

3. **Legacy Session Auth** (`SESSION_SECRET`, `OPERATOR_PASSWORD_HASH`):
   - **Status:** Removed in trust-boundary hardening (PR #249). Authentication is enforced via server-side BFF with `API_SECRET`.

4. **Public Database URL** (`NEXT_PUBLIC_DATABASE_URL`):
   - **Status:** Strictly forbidden. Guarded by runtime/test assertions to prevent credential leakage.
   - **Ops:** Run [`docs/runbooks/next-public-database-url-deploy-audit.md`](runbooks/next-public-database-url-deploy-audit.md) after deploys or env drift reviews.

---

## 5. Verification Checklist for Vercel Deployments

1. **Production Deployment (`production` branch):**
   - [ ] `DATABASE_URL` configured with valid Neon pooled connection.
   - [ ] `API_SECRET` configured with high-entropy bearer token.
   - [ ] `OPENROUTER_API_KEY` configured for AI services.
   - [ ] `SENTRY_AUTH_TOKEN` present in build environment (for sourcemap uploads).
   - [ ] `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` configured for observability.
   - [ ] If voice screening is used: all four `LIVEKIT_*` variables set.

2. **Preview Deployments (`preview` branches):**
   - [ ] `DATABASE_URL` points to staging/preview Neon database branch.
   - [ ] `API_SECRET` set (preview environment allows relaxed checks, but BFF requires token).
   - [ ] `OPENROUTER_API_KEY` present.

3. **Workers / scrapers / Trigger.dev:**
   - [ ] `TRIGGER_SECRET_KEY` present for Trigger deploy/runtime.
   - [ ] Browserbase + Firecrawl keys present when scrapers enabled.
   - [ ] After Trigger task changes, deploy Trigger with local env sourced (see deployment verification summary).

4. **Vercel-only — Deployment Protection:**
   - [ ] If Protection is on, configure `VERCEL_AUTOMATION_BYPASS_SECRET` (or dashboard bypass) for CI/curl.
   - [ ] Smoke `GET https://motian.vercel.app/api/gezondheid` (may require bypass header).

5. **Hygiene (names only in tickets):**
   - [ ] Prefer `vercel env ls` over printing values.
   - [ ] Never commit `.env`, `.env.local`, or `vercel env pull` output.
   - [ ] Diff live Vercel names against this inventory when CLI is authenticated.
   - [ ] Confirm `NEXT_PUBLIC_DATABASE_URL` is **absent** on Vercel, Coolify, and Trigger.dev — [`next-public-database-url-deploy-audit.md`](runbooks/next-public-database-url-deploy-audit.md).

