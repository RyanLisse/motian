import { additionalPackages, syncEnvVars } from "@trigger.dev/build/extensions/core";
import * as Sentry from "@sentry/node";
import { defineConfig } from "@trigger.dev/sdk";

const SENTRY_DSN = process.env.SENTRY_DSN;

let sentryInitialized = false;
function ensureSentry() {
  if (sentryInitialized) return true;
  if (!SENTRY_DSN) return false;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? "development",
    tracesSampleRate: 0.2,
    enableLogs: true,
  });
  sentryInitialized = true;

  return true;
}

export default defineConfig({
  project: "proj_nqihauooanbnqnbpoybp",
  dirs: ["./trigger"],
  runtime: "node-22",
  maxDuration: 1800, // 30 min global default — scrape pipeline with Firecrawl needs headroom
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
      "playwright",
      "playwright-core",
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
      extra: { payload },
    });
    await Sentry.flush(2000);
  },
});
