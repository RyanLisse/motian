import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://f13da1ff32b7d1f499309c7040de8fae@o4507090437668864.ingest.de.sentry.io/4510936878481488",
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.5,
  enableLogs: true,
});

// Navigation tracing for Next.js App Router
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
