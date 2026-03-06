/**
 * Benchmark for hybridSearch(query, filters).
 * Run with: pnpm tsx scripts/benchmark-hybrid-search.ts
 * Requires DATABASE_URL (e.g. from .env.local). Uses limit 10, 100, and 10×100 for reference.
 * Writes summary to docs/metrics/hybrid-search-benchmark-latest.json for baseline/regression.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env.local" });

async function main() {
  const limits = [10, 100];
  const query = "developer";
  const results: { limit: number; ms: number; count: number }[] = [];

  const { hybridSearch } = await import("../src/services/jobs.ts");

  for (const limit of limits) {
    const start = Date.now();
    const rows = await hybridSearch(query, { limit });
    const ms = Date.now() - start;
    results.push({ limit, ms, count: rows.length });
    console.log(
      `hybridSearch("${query}", { limit: ${limit} }) → ${rows.length} results in ${ms}ms`,
    );
  }

  // One run with limit 100 repeated 10x to simulate ~1000 result workload (reference only)
  const start1k = Date.now();
  for (let i = 0; i < 10; i++) {
    await hybridSearch(query, { limit: 100 });
  }
  const ms1k = Date.now() - start1k;
  console.log(
    `10 × hybridSearch(..., { limit: 100 }) → ${ms1k}ms total (avg ${(ms1k / 10).toFixed(0)}ms/run)`,
  );

  const summary = {
    date: new Date().toISOString(),
    query,
    runs: results,
    tenTimes100Ms: ms1k,
    avgPerRun100: Math.round(ms1k / 10),
  };

  console.log("\nSummary:");
  console.log(JSON.stringify(summary, null, 2));

  const outDir = path.join(process.cwd(), "docs", "metrics");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "hybrid-search-benchmark-latest.json");
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), "utf8");
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
