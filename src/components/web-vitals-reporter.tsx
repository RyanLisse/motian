"use client";

import * as Sentry from "@sentry/nextjs";
import { useReportWebVitals } from "next/web-vitals";
import posthog from "posthog-js";

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0];

const WEB_VITAL_THRESHOLDS: Partial<Record<string, number>> = {
  CLS: 0.1,
  FCP: 1800,
  INP: 200,
  LCP: 2500,
  TTFB: 800,
};

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
  useReportWebVitals(handleWebVital);
  return null;
}
