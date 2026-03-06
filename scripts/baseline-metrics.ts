/**
 * Baseline metrics capture for Fase 1.
 * Measures pnpm build time and writes docs/metrics/baseline-YYYY-MM-DD.md.
 * Run: pnpm tsx scripts/baseline-metrics.ts
 *
 * API latency, DB query duration, Trigger job duration and AI costs
 * require a running app and are documented in docs/metrics/README.md.
 */
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

function getPnpmVersion(): string {
  try {
    return execSync("pnpm --version", { encoding: "utf8", cwd: process.cwd() }).trim();
  } catch {
    return "—";
  }
}

function runBuild(): number {
  const start = Date.now();
  execSync("pnpm build", {
    stdio: "inherit",
    cwd: path.resolve(process.cwd()),
  });
  return Date.now() - start;
}

function main() {
  console.log("Baseline metrics — build time\n");
  const pnpmVersion = getPnpmVersion();
  const buildMs = runBuild();
  const buildSec = (buildMs / 1000).toFixed(2);
  console.log(`\nBuild completed in ${buildSec}s (${buildMs}ms)`);

  const outDir = path.join(process.cwd(), "docs", "metrics");
  fs.mkdirSync(outDir, { recursive: true });

  const snippet = [
    `## Baseline ${date}`,
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| \`pnpm build\` (local) | ${buildSec}s |`,
    `| Node | ${process.version} |`,
    `| pnpm | ${pnpmVersion} |`,
    `| Date | ${new Date().toISOString()} |`,
    "| Dataset (jobs count) | _optional_ |",
    "| Cold start / p95 `/api/chat` | _see README_ |",
    "| Cold start / p95 `/api/cv-analyse` | _see README_ |",
    "| DB query (search/match) | _see README_ |",
    "| Trigger job duration | _see README_ |",
    "| AI cost per flow | _see README_ |",
    "",
    "See README in this folder for API latency, DB, Trigger and AI-cost capture.",
  ].join("\n");

  const artifactPath = path.join(outDir, `baseline-${date}.md`);
  fs.writeFileSync(artifactPath, snippet, "utf8");
  console.log(`\nWrote ${artifactPath}`);
}

main();
