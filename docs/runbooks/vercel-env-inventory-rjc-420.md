# RJC-420 — Vercel Motian environment variable inventory (NAMES only)

> Companion checklist/grouped inventory for RJC-420. Narrative matrix: [`docs/rjc-420-vercel-env-inventory.md`](../rjc-420-vercel-env-inventory.md).


> **Security:** Lists **environment variable names only**. Never paste secret **values** into chat, git, PRs, Linear, Slack, or screenshots. Prefer `vercel env ls` (names) over `vercel env pull`. Keep `.env.local` gitignored.

**Linear:** RJC-420 (Motian M0)
**Sources (2026-09-04):** `.env.example`, `src/env.ts`, `process.env` usage, `trigger.config.ts` syncEnvVars, `docs/deployment-verification-summary.md`.
**Vercel CLI:** not installed/authenticated on `motian.exe.xyz` at inventory time — live `vercel env ls` not pulled.

**Production surfaces (public):** `https://motian.vercel.app`, Trigger.dev `proj_nqihauooanbnqnbpoybp`, Vercel project `motian`.

---

## Checklist — inventory / rotate / verify (no values in tickets)

- [ ] `vercel link` to project `motian`
- [ ] `vercel env ls` — names + environments only; redact values
- [ ] Diff Vercel names vs this inventory; file gaps without values
- [ ] Neon: `DATABASE_URL` (+ `DATABASE_URL_UNPOOLED` if needed)
- [ ] Trigger.dev: `TRIGGER_SECRET_KEY`; deploy with sourced `.env.local`
- [ ] AI: prefer `OPENROUTER_API_KEY`; verify legacy OpenAI/Google keys on Vercel
- [ ] Scrapers: Browserbase + Firecrawl + Striive (+ Modal)
- [ ] Auth: `API_SECRET`, `ALLOWED_ORIGINS`, optional `CRON_SECRET`
- [ ] Sentry: DSN + public DSN + org/project; auth token only if sourcemaps
- [ ] Public URLs: `NEXT_URL`, `PUBLIC_API_BASE_URL`, `AUTOPILOT_BASE_URL`, `MOTIA_API_URL`
- [ ] **Vercel-only Deployment Protection:** `VERCEL_AUTOMATION_BYPASS_SECRET` for CI/curl when Protection on
- [ ] Smoke `GET https://motian.vercel.app/api/gezondheid` (may need bypass)
- [ ] Never commit `.env`, `.env.local`, or `vercel env pull` output

---

## Grouped inventory (names)

Legend: **E** `.env.example`, **S** `src/env.ts`, **C** code/docs/trigger, **V** Vercel platform/Deployment Protection.

### Trigger.dev syncEnvVars (overlap with other groups)

- Critical at deploy: `DATABASE_URL`, `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, `FIRECRAWL_API_KEY`
- Optional: `OPENROUTER_API_KEY`, `STRIIVE_USERNAME`, `STRIIVE_PASSWORD`, `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`, `SENTRY_DSN`, `AUTOPILOT_BASE_URL`, `AUTOPILOT_GITHUB_TOKEN`, `AUTOPILOT_EVIDENCE_DIR`, `AUTOPILOT_RICH_EVIDENCE`, `GITHUB_REPOSITORY`, `GITHUB_SHA`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_URL`

### Neon / database

| Name | Sources | Notes |
|------|---------|-------|
| `DATABASE_URL` | E S C | Primary Neon Postgres URL |
| `DATABASE_URL_UNPOOLED` | C | Docs/tooling; not in src/env.ts schema |
| `NEXT_PUBLIC_DATABASE_URL` | C | Audit anti-pattern; prefer server-only DB URL |

### Trigger.dev

| Name | Sources | Notes |
|------|---------|-------|
| `TRIGGER_SECRET_KEY` | C | Required hosted; missing from .env.example/src/env.ts |

### AI / embeddings

| Name | Sources | Notes |
|------|---------|-------|
| `OPENROUTER_API_KEY` | E S C | Primary AI gateway |
| `OPENAI_API_KEY` | C | Legacy/docs leftover — verify on Vercel |
| `GOOGLE_GENERATIVE_AI_API_KEY` | C | Legacy/docs leftover — verify on Vercel |
| `LANGSMITH_TRACING` | E S | Optional tracing |
| `LANGSMITH_API_KEY` | E S |  |
| `LANGSMITH_PROJECT` | E S |  |
| `LANGCHAIN_API_KEY` | S C | Legacy alias |
| `LANGCHAIN_TRACING_V2` | E comment | Legacy commented |
| `LANGCHAIN_PROJECT` | E comment | Legacy commented |
| `OTEL_ENABLED` | E S | Vercel AI SDK / OTEL |
| `CHAT_MAX_TOKENS_PER_SESSION` | S C |  |
| `HYBRID_BLEND_RULE` | E S |  |
| `HYBRID_BLEND_VECTOR` | E S |  |
| `HYBRID_SEARCH_ALLOW_SHORT_VECTOR` | C |  |
| `HYBRID_SEARCH_PAGE_ONLY_HYDRATION` | C |  |

### Scrapers / platforms / sandbox

| Name | Sources | Notes |
|------|---------|-------|
| `BROWSERBASE_API_KEY` | E S C |  |
| `BROWSERBASE_PROJECT_ID` | E S C |  |
| `FIRECRAWL_API_KEY` | E S C |  |
| `STRIIVE_USERNAME` | E S C |  |
| `STRIIVE_PASSWORD` | E S C |  |
| `STRIIVE_SESSION_COOKIE` | E S | Optional override |
| `STRIIVE_USE_MODAL` | E S |  |
| `STRIIVE_LIMIT` | C |  |
| `STRIIVE_MAX_PAGES` | C |  |
| `MODAL_TOKEN_ID` | E S C |  |
| `MODAL_TOKEN_SECRET` | E S C |  |
| `LINKEDIN_USERNAME` | E S |  |
| `LINKEDIN_PASSWORD` | E S |  |
| `SCRAPE_TARGETS` | C |  |
| `MAX_AGE_MINUTES` | C |  |
| `AUTOPILOT_BASE_URL` | E S C |  |
| `AUTOPILOT_GITHUB_TOKEN` | E S C |  |
| `AUTOPILOT_RICH_EVIDENCE` | E S | failures|always |
| `AUTOPILOT_EVIDENCE_DIR` | S C |  |

### Auth / API boundary

| Name | Sources | Notes |
|------|---------|-------|
| `API_SECRET` | E S | Bearer for protected /api |
| `ALLOWED_ORIGINS` | E S |  |
| `CRON_SECRET` | S C |  |
| `ENCRYPTION_SECRET` | E S | Canonical in src/env.ts |
| `SKIP_ENV_VALIDATION` | S C | Build/CI only |

### Sentry / observability / analytics

| Name | Sources | Notes |
|------|---------|-------|
| `SENTRY_DSN` | E S C |  |
| `NEXT_PUBLIC_SENTRY_DSN` | E S |  |
| `SENTRY_ORG` | E S |  |
| `SENTRY_PROJECT` | E S |  |
| `SENTRY_AUTH_TOKEN` | S C | Vercel/CI only; never commit |
| `NEXT_PUBLIC_POSTHOG_KEY` | E S |  |
| `NEXT_PUBLIC_POSTHOG_HOST` | E S |  |

### Public URLs / host

| Name | Sources | Notes |
|------|---------|-------|
| `NEXT_URL` | E S |  |
| `PUBLIC_API_BASE_URL` | E S |  |
| `MOTIA_API_URL` | E S |  |
| `HOSTNAME` | E S |  |
| `PORT` | E S |  |
| `BASE_URL` | C |  |
| `MARKDOWN_FAST_URL` | S C |  |
| `MARKDOWN_FAST_TOKEN` | S C |  |

### Vercel-only / Deployment Protection

| Name | Sources | Notes |
|------|---------|-------|
| `VERCEL_ENV` | S C | Auto-injected |
| `VERCEL_URL` | S C | Auto-injected |
| `VERCEL_GIT_COMMIT_SHA` | S C | Auto-injected |
| `NEXT_PUBLIC_VERCEL_ENV` | C |  |
| `NEXT_RUNTIME` | C |  |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | V | Deployment Protection bypass for CI/curl |

### Other optional / scoring

| Name | Sources | Notes |
|------|---------|-------|
| `TYPESENSE_URL` | E |  |
| `TYPESENSE_API_KEY` | E |  |
| `TYPESENSE_JOBS_COLLECTION` | E |  |
| `TYPESENSE_CANDIDATES_COLLECTION` | E |  |
| `BLOB_READ_WRITE_TOKEN` | S C | Vercel Blob |
| `UPSTASH_REDIS_REST_URL` | S C |  |
| `UPSTASH_REDIS_REST_TOKEN` | S C |  |
| `RESEND_API_KEY` | C |  |
| `RESEND_FROM_EMAIL` | C |  |
| `SLACK_BOT_TOKEN` | E S |  |
| `SLACK_CHANNEL_ID` | E S |  |
| `LIVEKIT_URL` | E S |  |
| `LIVEKIT_API_KEY` | E S |  |
| `LIVEKIT_API_SECRET` | E S |  |
| `NEXT_PUBLIC_LIVEKIT_URL` | E S |  |
| `WHATSAPP_ENABLED` | S C |  |
| `WHATSAPP_AUTH_DIR` | S C |  |
| `WHATSAPP_RATE_LIMIT` | S C |  |
| `SCORING_WEIGHT_SKILLS` | E S |  |
| `SCORING_WEIGHT_LOCATION` | E S |  |
| `SCORING_WEIGHT_RATE` | E S |  |
| `SCORING_WEIGHT_ROLE` | E S |  |
| `RECENCY_BOOST_DAYS` | E S |  |
| `RECENCY_PENALTY_DAYS` | E S |  |
| `RECENCY_BOOST_AMOUNT` | E S |  |
| `RECENCY_PENALTY_AMOUNT` | E S |  |
| `QUALITY_SIGNAL_DECAY_DAYS` | E S |  |
| `QUALITY_HIGH_APPROVAL_THRESHOLD` | E S |  |
| `QUALITY_LOW_APPROVAL_THRESHOLD` | E S |  |
| `QUALITY_HIGH_APPROVAL_BOOST` | E S |  |
| `QUALITY_LOW_APPROVAL_PENALTY` | E S |  |
| `QUALITY_MIN_DECISIONS` | E S |  |
| `ESCO_VERSION` | S C |  |
| `ESCO_CRITICAL_REVIEW_THRESHOLD` | S C |  |
| `ESCO_SCORING_ENABLED` | S C |  |
| `SKILL_SCORING_ENABLED` | C |  |
| `USE_ESCO_SCORING` | C |  |
| `USE_SKILL_SCORING` | C |  |
| `RATE_CAP_EUR` | S C |  |
| `AUTO_MATCH_MIN_SCORE` | C |  |
| `AUTO_MATCH_TOP_N` | C |  |

Platform/CI passthrough (not product secrets): `CI`, `GITHUB_REPOSITORY`, `GITHUB_SHA`, `GITHUB_OUTPUT`, `GITHUB_BASE_REF`, `NODE_ENV`.

E2E/local harness (usually not production Vercel): `E2E_*`, `PLAYWRIGHT_CHROMIUM_PATH`, `MOTIAN_VERIFY_CHROME_CHANNEL`, `ANALYZE`, `HARNESS_DISPATCH`.

---

## Name-count summary (no values)

**Total unique names inventoried: 105**

- Neon / database: 3
- Trigger.dev: 1
- AI / embeddings: 15
- Scrapers / platforms / sandbox: 19
- Auth / API boundary: 5
- Sentry / observability / analytics: 7
- Public URLs / host: 8
- Vercel-only / Deployment Protection: 6
- Other optional / scoring: 41

### Known drifts (follow-ups, no secrets)

1. Deployment summary still lists `OPENAI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` while app emphasizes OpenRouter.
2. `TRIGGER_SECRET_KEY` and `DATABASE_URL_UNPOOLED` missing from `.env.example`.
3. Audit `NEXT_PUBLIC_DATABASE_URL` (should not expose DB to client).
4. Live Vercel name list pending CLI auth on build host.

---

## Related

- `docs/deployment-verification-summary.md`
- `src/env.ts`
- `trigger.config.ts`
