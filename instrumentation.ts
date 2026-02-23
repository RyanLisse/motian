import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN =
  "https://f13da1ff32b7d1f499309c7040de8fae@o4507090437668864.ingest.de.sentry.io/4510936878481488";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.VERCEL_ENV ?? "development",
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1,
      enableLogs: true,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.VERCEL_ENV ?? "development",
      tracesSampleRate: 0.1,
      enableLogs: true,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
