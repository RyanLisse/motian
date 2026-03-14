/**
 * capture-browser-evidence.ts
 *
 * Captures browser evidence (screenshots + manifest) for key Motian UI flows.
 * Uses Playwright directly (not the test runner). Run with:
 *   pnpm tsx scripts/harness/capture-browser-evidence.ts
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = `http://localhost:${process.env.PORT ?? 3002}`;
const EVIDENCE_DIR = resolve(process.cwd(), "harness-evidence");
const VIEWPORT = { width: 1280, height: 720 };
const TIMEOUT_MS = 30_000;

interface PageTarget {
  /** URL path to capture */
  path: string;
  /** Slug used in the output filename */
  slug: string;
}

const PAGE_TARGETS: PageTarget[] = [
  { path: "/overzicht", slug: "overzicht" },
  { path: "/opdrachten", slug: "opdrachten" },
  { path: "/professionals", slug: "professionals" },
  { path: "/pipeline", slug: "pipeline" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureEvidenceDir(): void {
  if (!existsSync(EVIDENCE_DIR)) {
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    console.log(`Created evidence directory: ${EVIDENCE_DIR}`);
  }
}

function currentGitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

// ---------------------------------------------------------------------------
// Manifest types
// ---------------------------------------------------------------------------

interface EvidenceEntry {
  slug: string;
  path: string;
  screenshotFile: string;
  capturedAt: string;
  pageTitle: string;
}

interface Manifest {
  gitSha: string;
  generatedAt: string;
  baseUrl: string;
  entries: EvidenceEntry[];
}

// ---------------------------------------------------------------------------
// Main capture logic
// ---------------------------------------------------------------------------

async function captureEvidence(): Promise<void> {
  ensureEvidenceDir();

  const gitSha = currentGitSha();
  const ts = timestamp();

  console.log("");
  console.log("=== Motian Browser Evidence Capture ===");
  console.log(`Git SHA  : ${gitSha}`);
  console.log(`Timestamp: ${ts}`);
  console.log(`Output   : ${EVIDENCE_DIR}`);
  console.log("");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
  });

  const entries: EvidenceEntry[] = [];

  for (const target of PAGE_TARGETS) {
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT_MS);
    page.setDefaultNavigationTimeout(TIMEOUT_MS);

    const url = `${BASE_URL}${target.path}`;
    const screenshotFilename = `${target.slug}-${ts}.png`;
    const screenshotPath = join(EVIDENCE_DIR, screenshotFilename);

    console.log(`Capturing: ${url}`);

    try {
      const response = await page.goto(url, { waitUntil: "networkidle" });

      if (!response || !response.ok()) {
        console.warn(`  Warning: Non-OK response (${response?.status()}) for ${url}`);
      }

      const pageTitle = await page.title();

      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });

      const capturedAt = new Date().toISOString();

      entries.push({
        slug: target.slug,
        path: target.path,
        screenshotFile: screenshotFilename,
        capturedAt,
        pageTitle,
      });

      console.log(`  Saved  : ${screenshotFilename}`);
      console.log(`  Title  : ${pageTitle}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR capturing ${url}: ${message}`);
    } finally {
      await page.close();
    }
  }

  await context.close();
  await browser.close();

  // Write manifest
  const manifest: Manifest = {
    gitSha,
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    entries,
  };

  const manifestPath = join(EVIDENCE_DIR, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  // Summary
  console.log("");
  console.log("=== Capture Summary ===");
  console.log(`Total pages : ${PAGE_TARGETS.length}`);
  console.log(`Captured    : ${entries.length}`);
  console.log(`Failed      : ${PAGE_TARGETS.length - entries.length}`);
  console.log(`Manifest    : ${manifestPath}`);
  console.log("");

  if (entries.length === 0) {
    console.error(
      `ERROR: No screenshots were captured. Is the dev server running on port ${process.env.PORT ?? 3002}?`,
    );
    process.exit(1);
  }
}

captureEvidence().catch((err) => {
  console.error("Unhandled error during capture:", err);
  process.exit(1);
});
