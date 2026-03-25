/**
 * Measure p50 / p95 / p99 for key vacature-search paths.
 *
 * Run with:
 *   pnpm metrics:search-path-latency
 *
 * Requires DATABASE_URL (for example via `.env.local`).
 * Writes output to `docs/metrics/search-path-latency-latest.json`.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { config as dotenvConfig } from "dotenv";
import { isPostgresDatabase } from "../src/db";
import type { QueryPath } from "../src/lib/query-observability";
import { computePercentile } from "../src/services/esco-rollout-metrics";
import { searchJobsUnified } from "../src/services/jobs";
import { HYBRID_SEARCH_SHORT_QUERY_TEXT_ONLY_ENV } from "../src/services/jobs/hybrid-search-policy";

type ScenarioDefinition = {
  name: string;
  queryPath: QueryPath;
  runs: number;
  required: boolean;
  action: () => Promise<unknown>;
};

type ScenarioSummary = {
  name: string;
  queryPath: QueryPath;
  runs: number;
  successfulRuns: number;
  failedRuns: number;
  p50Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
};

dotenvConfig({ path: ".env.local" });

const BASELINE_MEASURED_RUNS = 30;
const WARMUP_RUNS = 1;

async function withHybridSearchEnv<T>(
  updates: Record<string, string>,
  run: () => Promise<T>,
): Promise<T> {
  const snapshot = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(updates)) {
    snapshot.set(key, process.env[key]);
    process.env[key] = value;
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of snapshot.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function createScenarioSummary(
  name: string,
  queryPath: QueryPath,
  durationsMs: number[],
  runs: number,
  failedRuns: number,
): ScenarioSummary {
  const sorted = [...durationsMs].sort((a, b) => a - b);
  return {
    name,
    queryPath,
    runs,
    successfulRuns: durationsMs.length,
    failedRuns,
    p50Ms: computePercentile(sorted, 50),
    p95Ms: computePercentile(sorted, 95),
    p99Ms: computePercentile(sorted, 99),
  };
}

async function runScenario(definition: ScenarioDefinition): Promise<ScenarioSummary> {
  const durationsMs: number[] = [];
  let failedRuns = 0;

  for (let warmupRun = 0; warmupRun < WARMUP_RUNS; warmupRun += 1) {
    try {
      await definition.action();
    } catch {
      if (definition.required) {
        throw new Error(`${definition.name} warmup failed`);
      }

      console.warn(
        `[warn] ${definition.name} warmup run ${warmupRun + 1}/${WARMUP_RUNS} failed. Continuing baseline capture.`,
      );
      break;
    }
  }

  for (let runIndex = 0; runIndex < definition.runs; runIndex += 1) {
    const startedAt = Date.now();
    try {
      await definition.action();
      durationsMs.push(Date.now() - startedAt);
    } catch {
      failedRuns += 1;
      if (definition.required) {
        throw new Error(`${definition.name} run ${runIndex + 1}/${definition.runs} failed`);
      }
    }
  }

  if (failedRuns > 0) {
    console.warn(
      `[warn] ${definition.name} had ${failedRuns} failed measured runs. Continuing baseline capture.`,
    );
  }

  if (!definition.required && durationsMs.length === 0) {
    return createScenarioSummary(
      definition.name,
      definition.queryPath,
      [],
      definition.runs,
      definition.runs,
    );
  }

  return createScenarioSummary(
    definition.name,
    definition.queryPath,
    durationsMs,
    definition.runs,
    failedRuns,
  );
}

function summarizeLatencySnapshot(scenarios: ScenarioSummary[]) {
  return {
    scenarios,
    aggregated: {
      totalScenarios: scenarios.length,
      successfulScenarios: scenarios.filter((scenario) => scenario.failedRuns === 0).length,
      successfulRuns: scenarios.reduce((sum, scenario) => sum + scenario.successfulRuns, 0),
      failedRuns: scenarios.reduce((sum, scenario) => sum + scenario.failedRuns, 0),
    },
  };
}

function buildScenarios(): ScenarioDefinition[] {
  return [
    {
      name: "list-jobs-default",
      queryPath: "list",
      required: true,
      runs: BASELINE_MEASURED_RUNS,
      action: () => searchJobsUnified({ limit: 20, offset: 0 }),
    },
    {
      name: "list-jobs-fts",
      queryPath: "list-fts",
      required: false,
      runs: BASELINE_MEASURED_RUNS,
      action: () => searchJobsUnified({ q: "developer", limit: 20, offset: 0 }),
    },
    {
      name: "search-text-short-query",
      queryPath: "search-text",
      required: true,
      runs: BASELINE_MEASURED_RUNS,
      action: () =>
        withHybridSearchEnv({ [HYBRID_SEARCH_SHORT_QUERY_TEXT_ONLY_ENV]: "true" }, () =>
          searchJobsUnified({ q: "in", limit: 20, offset: 0 }),
        ),
    },
    {
      name: "search-hybrid-vector",
      queryPath: "search-hybrid",
      required: false,
      runs: BASELINE_MEASURED_RUNS,
      action: () =>
        withHybridSearchEnv({ [HYBRID_SEARCH_SHORT_QUERY_TEXT_ONLY_ENV]: "false" }, () =>
          searchJobsUnified({ q: "frontend developer", limit: 20, offset: 0 }),
        ),
    },
  ];
}

async function main() {
  const scenarios = buildScenarios();
  const summaries: ScenarioSummary[] = [];

  for (const scenario of scenarios) {
    summaries.push(await runScenario(scenario));
  }

  const summaryOutput = {
    generatedAt: new Date().toISOString(),
    runsPerScenario: BASELINE_MEASURED_RUNS,
    warmupRuns: WARMUP_RUNS,
    isPostgresDatabase: isPostgresDatabase(),
    ...summarizeLatencySnapshot(summaries),
  };

  const outDir = path.join(process.cwd(), "docs", "metrics");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "search-path-latency-latest.json");
  fs.writeFileSync(outPath, `${JSON.stringify(summaryOutput, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
