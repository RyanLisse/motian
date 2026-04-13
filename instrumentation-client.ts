import * as Sentry from "@sentry/nextjs";
import { getSafeSentryDsn } from "@/src/lib/sentry-config";
import { scrubSentryEvent, SENTRY_IGNORE_ERRORS } from "@/src/lib/sentry-scrub";

const SENTRY_DSN = getSafeSentryDsn(process.env.NEXT_PUBLIC_SENTRY_DSN);

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.5,
    enableLogs: true,
    beforeSend: scrubSentryEvent,
    ignoreErrors: SENTRY_IGNORE_ERRORS,
    // maskAllText + blockAllMedia: prevent Session Replay from capturing candidate
    // names, emails, or other PII rendered in the DOM at the time of an error.
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
  });
}

// Navigation tracing for Next.js App Router
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
