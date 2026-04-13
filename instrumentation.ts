import * as Sentry from "@sentry/nextjs";
import { getPostHogServer } from "@/src/lib/posthog";
import { getSafeSentryDsn } from "@/src/lib/sentry-config";
import { scrubSentryEvent, SENTRY_IGNORE_ERRORS } from "@/src/lib/sentry-scrub";

const SENTRY_DSN = getSafeSentryDsn(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN);
const SENTRY_RELEASE = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA;

export function register() {
  if (!SENTRY_DSN) {
    return;
  }

  const sharedConfig: Sentry.NodeOptions = {
    dsn: SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? "development",
    release: SENTRY_RELEASE,
    ignoreErrors: SENTRY_IGNORE_ERRORS,
    enableLogs: true,
    beforeSend: scrubSentryEvent,
  };

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      ...sharedConfig,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      ...sharedConfig,
      tracesSampleRate: 0.1,
    });
  }
}

export async function onRequestError(
  error: { digest: string } & Error,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routerKind: string; routePath: string; routeType: string; renderSource: string },
) {
  // Sentry
  if (SENTRY_DSN) {
    Sentry.captureRequestError(error, request, context);
  }

  // PostHog server-side exception capture
  const posthog = getPostHogServer();
  if (posthog) {
    posthog.captureException(error, "motian-server", {
      route: context.routePath,
      method: request.method,
      path: request.path,
      routeType: context.routeType,
    });
  }
}
