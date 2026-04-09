"use client";

import * as Sentry from "@sentry/nextjs";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import posthog from "posthog-js";
import { useEffect } from "react";

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0];

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
    posthog.capture("web_vital_reported", payload);
  }

  const threshold = WEB_VITAL_THRESHOLDS[metric.name];
  if (threshold === undefined || metric.value <= threshold) {
    return;
  }

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
      posthog.capture("shell_hydration_timing", {
        route: pathname,
        hydrationMs,
        budgetMs: SHELL_HYDRATION_BUDGET_MS,
      });
    }

    if (hydrationMs <= SHELL_HYDRATION_BUDGET_MS) return;

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
  }, [pathname]);

  useReportWebVitals(handleWebVital);
  return null;
}
