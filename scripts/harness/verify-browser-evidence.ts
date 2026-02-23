/**
 * verify-browser-evidence.ts
 *
 * Verifies that harness-evidence screenshots are present, non-empty, fresh,
 * and were captured at the current git HEAD.
 *
 * Exit codes:
 *   0 = all checks pass
 *   1 = one or more checks failed
 *
 * Run with:
 *   pnpm tsx scripts/harness/verify-browser-evidence.ts
 *
 * Options (via env):
 *   MAX_AGE_MINUTES=60  - Maximum allowed evidence age in minutes (default 60)
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const EVIDENCE_DIR = resolve(process.cwd(), "harness-evidence");
const MANIFEST_PATH = join(EVIDENCE_DIR, "manifest.json");
const MAX_AGE_MINUTES = Number(process.env.MAX_AGE_MINUTES ?? "60");

// ---------------------------------------------------------------------------
// Types (must mirror capture script)
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
// Helpers
// ---------------------------------------------------------------------------

function currentGitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

function check(name: string, passed: boolean, detail: string): CheckResult {
  return { name, passed, detail };
}

// ---------------------------------------------------------------------------
// Verification logic
// ---------------------------------------------------------------------------

function verifyEvidence(): void {
  const results: CheckResult[] = [];
  let manifest: Manifest | null = null;

  // 1. Manifest exists
  const manifestExists = existsSync(MANIFEST_PATH);
  results.push(
    check(
      "Manifest file exists",
      manifestExists,
      manifestExists ? MANIFEST_PATH : `Not found: ${MANIFEST_PATH}`,
    ),
  );

  if (!manifestExists) {
    printResults(results);
    process.exit(1);
  }

  // 2. Manifest is valid JSON
  try {
    const raw = readFileSync(MANIFEST_PATH, "utf8");
    manifest = JSON.parse(raw) as Manifest;
    results.push(check("Manifest is valid JSON", true, `${manifest.entries.length} entries`));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push(check("Manifest is valid JSON", false, `Parse error: ${msg}`));
    printResults(results);
    process.exit(1);
  }

  // 3. Freshness check
  const generatedAt = new Date(manifest.generatedAt);
  const ageMs = Date.now() - generatedAt.getTime();
  const ageMinutes = ageMs / 1000 / 60;
  const fresh = ageMinutes <= MAX_AGE_MINUTES;
  results.push(
    check(
      `Evidence is fresh (< ${MAX_AGE_MINUTES} min)`,
      fresh,
      `Age: ${ageMinutes.toFixed(1)} minutes (captured ${manifest.generatedAt})`,
    ),
  );

  // 4. Git SHA matches current HEAD
  const currentSha = currentGitSha();
  const shaMatches = manifest.gitSha !== "unknown" && manifest.gitSha === currentSha;
  results.push(
    check(
      "Evidence git SHA matches HEAD",
      shaMatches,
      shaMatches
        ? `SHA: ${currentSha.slice(0, 8)}`
        : `Manifest: ${manifest.gitSha.slice(0, 8)} | HEAD: ${currentSha.slice(0, 8)}`,
    ),
  );

  // 5. Per-screenshot checks
  for (const entry of manifest.entries) {
    const screenshotPath = join(EVIDENCE_DIR, entry.screenshotFile);

    // File exists
    const fileExists = existsSync(screenshotPath);
    results.push(
      check(
        `Screenshot exists: ${entry.slug}`,
        fileExists,
        fileExists ? screenshotPath : `Not found: ${screenshotPath}`,
      ),
    );

    if (!fileExists) continue;

    // File is non-zero size
    const stat = statSync(screenshotPath);
    const nonEmpty = stat.size > 0;
    results.push(
      check(
        `Screenshot non-empty: ${entry.slug}`,
        nonEmpty,
        nonEmpty ? `${stat.size.toLocaleString()} bytes` : "File is empty (0 bytes)",
      ),
    );
  }

  printResults(results);

  const allPassed = results.every((r) => r.passed);
  process.exit(allPassed ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function printResults(results: CheckResult[]): void {
  console.log("");
  console.log("=== Browser Evidence Verification ===");
  console.log("");

  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);

  for (const result of results) {
    const icon = result.passed ? "PASS" : "FAIL";
    const line = `  [${icon}] ${result.name}`;
    const detail = `         ${result.detail}`;
    console.log(line);
    console.log(detail);
  }

  console.log("");
  console.log(`Checks passed : ${passed.length} / ${results.length}`);

  if (failed.length > 0) {
    console.log(`Checks failed : ${failed.length}`);
    console.log("");
    console.log("Failed checks:");
    for (const f of failed) {
      console.log(`  - ${f.name}: ${f.detail}`);
    }
    console.log("");
    console.log("RESULT: FAIL");
  } else {
    console.log("");
    console.log("RESULT: PASS");
  }

  console.log("");
}

verifyEvidence();
