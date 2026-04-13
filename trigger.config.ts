import { additionalPackages, syncEnvVars } from "@trigger.dev/build/extensions/core";
import * as Sentry from "@sentry/node";
import { defineConfig } from "@trigger.dev/sdk";
import { getSafeSentryDsn } from "./src/lib/sentry-config";
import { scrubSentryEvent, SENTRY_IGNORE_ERRORS } from "./src/lib/sentry-scrub";

const SENTRY_DSN = getSafeSentryDsn(process.env.SENTRY_DSN);

let sentryInitialized = false;
function ensureSentry() {
  if (sentryInitialized) return true;
  if (!SENTRY_DSN) return false;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? "development",
    tracesSampleRate: 0.2,
    enableLogs: true,
    ignoreErrors: SENTRY_IGNORE_ERRORS,
    // scrubSentryEvent is typed against @sentry/nextjs ErrorEvent; the type is
    // structurally identical to @sentry/node's ErrorEvent (both from @sentry/core).
    beforeSend: (event, hint) =>
      scrubSentryEvent(
        event as Parameters<typeof scrubSentryEvent>[0],
        hint as Parameters<typeof scrubSentryEvent>[1],
      ),
  });
  sentryInitialized = true;

  return true;
}

export default defineConfig({
  project: "proj_nqihauooanbnqnbpoybp",
  dirs: ["./trigger"],
  runtime: "node-22",
  maxDuration: 300, // 5 min global default — only scrape-pipeline overrides to 1800
  logLevel: "info",
  enableConsoleLogging: true,
  // Externalize pg and drizzle-orm to avoid bundling native modules
  build: {
    extensions: [
      additionalPackages({ packages: ["puppeteer-core"] }),
      syncEnvVars(async () => {
        const keys = [
          "DATABASE_URL",
          "FIRECRAWL_API_KEY",
          "BROWSERBASE_API_KEY",
          "BROWSERBASE_PROJECT_ID",
          "STRIIVE_USERNAME",
          "STRIIVE_PASSWORD",
          "MODAL_TOKEN_ID",
          "MODAL_TOKEN_SECRET",
          "SENTRY_DSN",
          "AUTOPILOT_BASE_URL",
          "AUTOPILOT_GITHUB_TOKEN",
          "AUTOPILOT_EVIDENCE_DIR",
          "AUTOPILOT_RICH_EVIDENCE",
          "GITHUB_REPOSITORY",
          "GITHUB_SHA",
          "VERCEL_GIT_COMMIT_SHA",
          "VERCEL_URL",
        ];
        return keys
          .filter((key) => process.env[key])
          .map((key) => {
            let value = process.env[key]!;
            // Strip channel_binding param — not supported by all pg client versions
            if (key === "DATABASE_URL") {
              value = value.replace(/[&?]channel_binding=[^&]*/g, "");
            }
            return { name: key, value };
          });
      }),
    ],
    external: [
      "pg",
      "pg-native", // Optional native bindings
      "drizzle-orm/pg-core",
      "puppeteer-core",
      "chromium-bidi",
    ],
  },
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30000,
      factor: 2,
      randomize: true,
    },
  },
  onFailure: async ({ payload, error, ctx }) => {
    if (!ensureSentry()) {
      return;
    }

    Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
      tags: { source: "trigger-dev", taskId: ctx.task.id, runId: ctx.run.id },
      // Do not pass raw payload — task payloads may contain candidate PII.
      // Log only the payload shape (field names) for debugging, never values.
      extra: {
        payloadKeys: payload !== null && typeof payload === "object" ? Object.keys(payload) : [],
      },
    });
    await Sentry.flush(2000);
  },
});
