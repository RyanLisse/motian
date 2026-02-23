/**
 * playwright.harness.config.ts
 *
 * Playwright configuration for the Motian browser evidence harness.
 * Used by scripts/harness/capture-browser-evidence.ts (direct API, not test runner).
 *
 * This file documents the harness settings in a single place so they can be
 * imported and shared across harness scripts if needed.
 */

export interface HarnessConfig {
  baseUrl: string;
  viewport: { width: number; height: number };
  /** Full-page screenshot: captures content beyond the visible viewport */
  screenshotFullPage: boolean;
  timeoutMs: number;
  browser: "chromium" | "firefox" | "webkit";
  evidenceDir: string;
}

const config: HarnessConfig = {
  baseUrl: "http://localhost:3001",
  viewport: { width: 1280, height: 720 },
  screenshotFullPage: true,
  timeoutMs: 30_000,
  browser: "chromium",
  evidenceDir: "harness-evidence",
};

export default config;
