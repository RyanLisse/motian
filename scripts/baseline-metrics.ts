/**
 * Baseline metrics capture for Fase 1.
 * Measures pnpm build time and optionally writes a snippet for docs/metrics.
 * Run: pnpm tsx scripts/baseline-metrics.ts
 *
 * API latency, DB query duration, Trigger job duration and AI costs
 * require a running app and are documented in docs/metrics/README.md.
 */
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

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
  const buildMs = runBuild();
  const buildSec = (buildMs / 1000).toFixed(2);
  console.log(`\nBuild completed in ${buildSec}s (${buildMs}ms)`);

  const outDir = path.join(process.cwd(), "docs", "metrics");
  const snippet = [
    `## Baseline ${date}`,
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| \`pnpm build\` (local) | ${buildSec}s |`,
    `| Node | ${process.version} |`,
    `| Date | ${new Date().toISOString()} |`,
    "",
    "See README in this folder for API latency, DB, Trigger and AI-cost capture.",
  ].join("\n");

  const artifactPath = path.join(outDir, `baseline-${date}.md`);
  if (fs.existsSync(outDir)) {
    fs.writeFileSync(artifactPath, snippet, "utf8");
    console.log(`\nWrote ${artifactPath}`);
  } else {
    console.log(`\nSnippet (save to docs/metrics/baseline-${date}.md):\n${snippet}`);
  }
}

main();
