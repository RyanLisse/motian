import * as Sentry from "@sentry/nextjs";
import { getPostHogServer } from "@/src/lib/posthog";

const SENTRY_DSN = process.env.SENTRY_DSN;

export function register() {
  if (!SENTRY_DSN) {
    return;
  }

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
