import * as Sentry from "@sentry/nextjs";
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
  maxDuration: 600, // 10 min global default (scrape pipeline needs ~5 min)
  logLevel: "info",
  enableConsoleLogging: true,
  // Externalize pg and drizzle-orm to avoid bundling issues
  build: {
    external: ["pg", "drizzle-orm/pg-core", "@motian/db"],
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
