import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  // ── Server-side environment variables ──
  server: {
    // Database
    DATABASE_URL: z.string().url(),

    // Scraping
    BROWSERBASE_API_KEY: z.string().min(1).optional(),
    BROWSERBASE_PROJECT_ID: z.string().min(1).optional(),
    FIRECRAWL_API_KEY: z.string().min(1).optional(),

    // Striive
    STRIIVE_USERNAME: z.string().min(1).optional(),
    STRIIVE_PASSWORD: z.string().min(1).optional(),
    STRIIVE_SESSION_COOKIE: z.string().optional(),
    STRIIVE_USE_MODAL: z.string().optional(),

    // Modal
    MODAL_TOKEN_ID: z.string().min(1).optional(),
    MODAL_TOKEN_SECRET: z.string().min(1).optional(),

    // Autopilot
    AUTOPILOT_BASE_URL: z.string().url().optional(),
    AUTOPILOT_GITHUB_TOKEN: z.string().min(1).optional(),
    AUTOPILOT_EVIDENCE_DIR: z.string().optional(),
    AUTOPILOT_RICH_EVIDENCE: z.enum(["failures", "always"]).optional(),

    // AI model keys
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
    GOOGLE_API_KEY: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    X_AI_API_KEY: z.string().min(1).optional(),

    // Sentry (server) — accepts any non-empty string because DSN format
    // includes protocol+host but may use non-standard schemes
    SENTRY_DSN: z.string().min(1).optional(),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),

    // LangSmith
    LANGSMITH_TRACING: z.string().optional(),
    LANGSMITH_API_KEY: z.string().optional(),
    LANGSMITH_PROJECT: z.string().optional(),
    LANGCHAIN_API_KEY: z.string().optional(),

    // Observability
    OTEL_ENABLED: z.string().optional(),

    // LiveKit (server) — wss:// URL for WebSocket connection
    LIVEKIT_URL: z.string().url().optional(),
    LIVEKIT_API_KEY: z.string().optional(),
    LIVEKIT_API_SECRET: z.string().optional(),

    // LinkedIn
    LINKEDIN_USERNAME: z.string().optional(),
    LINKEDIN_PASSWORD: z.string().optional(),

    // Slack
    SLACK_BOT_TOKEN: z.string().optional(),
    SLACK_CHANNEL_ID: z.string().optional(),

    // WhatsApp
    WHATSAPP_ENABLED: z.string().optional(),
    WHATSAPP_AUTH_DIR: z.string().optional(),
    WHATSAPP_RATE_LIMIT: z.coerce.number().optional(),

    // Markdown.fast
    MARKDOWN_FAST_URL: z.string().url().optional(),
    MARKDOWN_FAST_TOKEN: z.string().optional(),

    // Vercel Blob
    BLOB_READ_WRITE_TOKEN: z.string().optional(),

    // ESCO
    ESCO_VERSION: z.string().optional(),
    ESCO_CRITICAL_REVIEW_THRESHOLD: z.coerce.number().min(0).max(1).optional(),
    ESCO_SCORING_ENABLED: z.string().optional(),

    // App config
    MOTIA_API_URL: z.string().url().optional(),
    NEXT_URL: z.string().url().optional(),
    PUBLIC_API_BASE_URL: z.string().url().optional(),
    ALLOWED_ORIGINS: z.string().optional(),
    API_SECRET: z.string().min(1).optional(),
    CRON_SECRET: z.string().optional(),
    ENCRYPTION_SECRET: z.string().min(32).optional(),
    PORT: z.coerce.number().optional(),
    HOSTNAME: z.string().optional(),
    RATE_CAP_EUR: z.coerce.number().optional(),
    CHAT_MAX_TOKENS_PER_SESSION: z.coerce.number().optional(),

    // Typesense — http(s):// URL for search index
    TYPESENSE_URL: z.string().url().optional(),
    TYPESENSE_API_KEY: z.string().optional(),
    TYPESENSE_JOBS_COLLECTION: z.string().optional(),
    TYPESENSE_CANDIDATES_COLLECTION: z.string().optional(),

    // Scoring weights
    SCORING_WEIGHT_SKILLS: z.coerce.number().min(0).max(100).optional(),
    SCORING_WEIGHT_LOCATION: z.coerce.number().min(0).max(100).optional(),
    SCORING_WEIGHT_RATE: z.coerce.number().min(0).max(100).optional(),
    SCORING_WEIGHT_ROLE: z.coerce.number().min(0).max(100).optional(),
    HYBRID_BLEND_RULE: z.coerce.number().min(0).max(1).optional(),
    HYBRID_BLEND_VECTOR: z.coerce.number().min(0).max(1).optional(),

    // Recency scoring
    RECENCY_BOOST_DAYS: z.coerce.number().optional(),
    RECENCY_PENALTY_DAYS: z.coerce.number().optional(),
    RECENCY_BOOST_AMOUNT: z.coerce.number().optional(),
    RECENCY_PENALTY_AMOUNT: z.coerce.number().optional(),

    // Quality signals
    QUALITY_SIGNAL_DECAY_DAYS: z.coerce.number().optional(),
    QUALITY_HIGH_APPROVAL_THRESHOLD: z.coerce.number().optional(),
    QUALITY_LOW_APPROVAL_THRESHOLD: z.coerce.number().optional(),
    QUALITY_HIGH_APPROVAL_BOOST: z.coerce.number().optional(),
    QUALITY_LOW_APPROVAL_PENALTY: z.coerce.number().optional(),
    QUALITY_MIN_DECISIONS: z.coerce.number().optional(),

    // Vercel platform (auto-injected)
    VERCEL_ENV: z.string().optional(),
    VERCEL_URL: z.string().optional(),
    VERCEL_GIT_COMMIT_SHA: z.string().optional(),
    GITHUB_REPOSITORY: z.string().optional(),
    GITHUB_SHA: z.string().optional(),
    CI: z.string().optional(),
    NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  },

  // ── Client-side environment variables (NEXT_PUBLIC_) ──
  client: {
    NEXT_PUBLIC_SENTRY_DSN: z.string().min(1).optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
    NEXT_PUBLIC_LIVEKIT_URL: z.string().optional(),
  },

  // ── Runtime env mapping (required by t3-env for tree-shaking safety) ──
  runtimeEnv: {
    // Server
    DATABASE_URL: process.env.DATABASE_URL,
    BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY,
    BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID,
    FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
    STRIIVE_USERNAME: process.env.STRIIVE_USERNAME,
    STRIIVE_PASSWORD: process.env.STRIIVE_PASSWORD,
    STRIIVE_SESSION_COOKIE: process.env.STRIIVE_SESSION_COOKIE,
    STRIIVE_USE_MODAL: process.env.STRIIVE_USE_MODAL,
    MODAL_TOKEN_ID: process.env.MODAL_TOKEN_ID,
    MODAL_TOKEN_SECRET: process.env.MODAL_TOKEN_SECRET,
    AUTOPILOT_BASE_URL: process.env.AUTOPILOT_BASE_URL,
    AUTOPILOT_GITHUB_TOKEN: process.env.AUTOPILOT_GITHUB_TOKEN,
    AUTOPILOT_EVIDENCE_DIR: process.env.AUTOPILOT_EVIDENCE_DIR,
    AUTOPILOT_RICH_EVIDENCE: process.env.AUTOPILOT_RICH_EVIDENCE,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    X_AI_API_KEY: process.env.X_AI_API_KEY,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    LANGSMITH_TRACING: process.env.LANGSMITH_TRACING,
    LANGSMITH_API_KEY: process.env.LANGSMITH_API_KEY,
    LANGSMITH_PROJECT: process.env.LANGSMITH_PROJECT,
    LANGCHAIN_API_KEY: process.env.LANGCHAIN_API_KEY,
    OTEL_ENABLED: process.env.OTEL_ENABLED,
    LIVEKIT_URL: process.env.LIVEKIT_URL,
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
    LINKEDIN_USERNAME: process.env.LINKEDIN_USERNAME,
    LINKEDIN_PASSWORD: process.env.LINKEDIN_PASSWORD,
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
    SLACK_CHANNEL_ID: process.env.SLACK_CHANNEL_ID,
    WHATSAPP_ENABLED: process.env.WHATSAPP_ENABLED,
    WHATSAPP_AUTH_DIR: process.env.WHATSAPP_AUTH_DIR,
    WHATSAPP_RATE_LIMIT: process.env.WHATSAPP_RATE_LIMIT,
    MARKDOWN_FAST_URL: process.env.MARKDOWN_FAST_URL,
    MARKDOWN_FAST_TOKEN: process.env.MARKDOWN_FAST_TOKEN,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    ESCO_VERSION: process.env.ESCO_VERSION,
    ESCO_CRITICAL_REVIEW_THRESHOLD: process.env.ESCO_CRITICAL_REVIEW_THRESHOLD,
    ESCO_SCORING_ENABLED: process.env.ESCO_SCORING_ENABLED,
    MOTIA_API_URL: process.env.MOTIA_API_URL,
    NEXT_URL: process.env.NEXT_URL,
    PUBLIC_API_BASE_URL: process.env.PUBLIC_API_BASE_URL,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    API_SECRET: process.env.API_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET,
    PORT: process.env.PORT,
    HOSTNAME: process.env.HOSTNAME,
    RATE_CAP_EUR: process.env.RATE_CAP_EUR,
    CHAT_MAX_TOKENS_PER_SESSION: process.env.CHAT_MAX_TOKENS_PER_SESSION,
    TYPESENSE_URL: process.env.TYPESENSE_URL,
    TYPESENSE_API_KEY: process.env.TYPESENSE_API_KEY,
    TYPESENSE_JOBS_COLLECTION: process.env.TYPESENSE_JOBS_COLLECTION,
    TYPESENSE_CANDIDATES_COLLECTION: process.env.TYPESENSE_CANDIDATES_COLLECTION,
    SCORING_WEIGHT_SKILLS: process.env.SCORING_WEIGHT_SKILLS,
    SCORING_WEIGHT_LOCATION: process.env.SCORING_WEIGHT_LOCATION,
    SCORING_WEIGHT_RATE: process.env.SCORING_WEIGHT_RATE,
    SCORING_WEIGHT_ROLE: process.env.SCORING_WEIGHT_ROLE,
    HYBRID_BLEND_RULE: process.env.HYBRID_BLEND_RULE,
    HYBRID_BLEND_VECTOR: process.env.HYBRID_BLEND_VECTOR,
    RECENCY_BOOST_DAYS: process.env.RECENCY_BOOST_DAYS,
    RECENCY_PENALTY_DAYS: process.env.RECENCY_PENALTY_DAYS,
    RECENCY_BOOST_AMOUNT: process.env.RECENCY_BOOST_AMOUNT,
    RECENCY_PENALTY_AMOUNT: process.env.RECENCY_PENALTY_AMOUNT,
    QUALITY_SIGNAL_DECAY_DAYS: process.env.QUALITY_SIGNAL_DECAY_DAYS,
    QUALITY_HIGH_APPROVAL_THRESHOLD: process.env.QUALITY_HIGH_APPROVAL_THRESHOLD,
    QUALITY_LOW_APPROVAL_THRESHOLD: process.env.QUALITY_LOW_APPROVAL_THRESHOLD,
    QUALITY_HIGH_APPROVAL_BOOST: process.env.QUALITY_HIGH_APPROVAL_BOOST,
    QUALITY_LOW_APPROVAL_PENALTY: process.env.QUALITY_LOW_APPROVAL_PENALTY,
    QUALITY_MIN_DECISIONS: process.env.QUALITY_MIN_DECISIONS,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
    GITHUB_SHA: process.env.GITHUB_SHA,
    CI: process.env.CI,
    NODE_ENV: process.env.NODE_ENV,

    // Client
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL,
  },

  // Skip validation in environments where env vars aren't available
  // (e.g., Docker builds, CI type-checking without .env)
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  // Allow empty strings for optional vars (they'll be treated as undefined by Zod)
  emptyStringAsUndefined: true,
});
