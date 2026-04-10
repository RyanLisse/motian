"use client";

import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { useEffect } from "react";

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0];

let posthogClientPromise: Promise<typeof import("posthog-js")["default"]> | null = null;
let sentryClientPromise: Promise<typeof import("@sentry/nextjs")> | null = null;

function getPostHogClient() {
  posthogClientPromise ??= import("posthog-js")
    .then((mod) => mod.default)
    .catch((error) => {
      posthogClientPromise = null;
      throw error;
    });
  return posthogClientPromise;
}

function getSentryClient() {
  sentryClientPromise ??= import("@sentry/nextjs").catch((error) => {
    sentryClientPromise = null;
    throw error;
  });
  return sentryClientPromise;
}

const WEB_VITAL_THRESHOLDS: Partial<Record<string, number>> = {
  CLS: 0.1,
  FCP: 1800,
  INP: 200,
  LCP: 2500,
  TTFB: 800,
};
const SHELL_HYDRATION_BUDGET_MS = 2000;
const SHELL_ROUTES = ["/overzicht", "/vacatures", "/kandidaten", "/pipeline", "/messages"];

const handleWebVital: ReportWebVitalsCallback = (metric) => {
  const payload = {
    id: metric.id,
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    rating: metric.rating,
    navigationType: metric.navigationType,
  };

  if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    void getPostHogClient()
      .then((posthog) => {
        posthog.capture("web_vital_reported", payload);
      })
      .catch(() => {});
  }

  const threshold = WEB_VITAL_THRESHOLDS[metric.name];
  if (threshold === undefined || metric.value <= threshold) {
    return;
  }

  void getSentryClient()
    .then((Sentry) => {
      Sentry.withScope((scope) => {
        scope.setLevel("warning");
        scope.setTag("telemetry", "web-vital");
        scope.setTag("metric", metric.name);
        scope.setTag("rating", metric.rating);
        scope.setContext("web-vital", {
          ...payload,
          threshold,
        });
        Sentry.captureMessage(`poor-web-vital:${metric.name}`);
      });
    })
    .catch(() => {});
};

export function WebVitalsReporter() {
  const pathname = usePathname();

  useEffect(() => {
    const isShellRoute = SHELL_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    );
    if (!isShellRoute) return;

    const navEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const navStart = navEntry?.startTime ?? 0;
    const hydrationMs = Math.round(performance.now() - navStart);

    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      void getPostHogClient()
        .then((posthog) => {
          posthog.capture("shell_hydration_timing", {
            route: pathname,
            hydrationMs,
            budgetMs: SHELL_HYDRATION_BUDGET_MS,
          });
        })
        .catch(() => {});
    }

    if (hydrationMs <= SHELL_HYDRATION_BUDGET_MS) return;

    void getSentryClient()
      .then((Sentry) => {
        Sentry.withScope((scope) => {
          scope.setLevel("warning");
          scope.setTag("telemetry", "shell-hydration");
          scope.setTag("route", pathname);
          scope.setContext("shell-hydration", {
            route: pathname,
            hydrationMs,
            budgetMs: SHELL_HYDRATION_BUDGET_MS,
          });
          Sentry.captureMessage("slow-shell-hydration");
        });
      })
      .catch(() => {});
  }, [pathname]);

  useReportWebVitals(handleWebVital);
  return null;
}
