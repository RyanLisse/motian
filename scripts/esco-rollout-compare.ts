/**
 * Compare two ESCO rollout snapshots and fail if p95 latency regresses beyond
 * the allowed threshold for any shared scenario.
 *
 * Usage:
 *   pnpm metrics:esco-rollout:compare docs/metrics/esco-rollout-snapshot-baseline.json
 *   pnpm metrics:esco-rollout:compare baseline.json latest.json
 */
import * as fs from "node:fs";
import * as path from "node:path";
import {
  compareSearchLatencyAgainstBaseline,
  type EscoRolloutSnapshot,
} from "../src/services/esco-rollout-metrics";

function readSnapshot(snapshotPath: string): EscoRolloutSnapshot {
  const resolvedPath = path.resolve(process.cwd(), snapshotPath);
  return JSON.parse(fs.readFileSync(resolvedPath, "utf8")) as EscoRolloutSnapshot;
}

function main() {
  const [baselinePath, latestPath = "docs/metrics/esco-rollout-snapshot-latest.json"] =
    process.argv.slice(2);

  if (!baselinePath) {
    console.error("Usage: pnpm metrics:esco-rollout:compare <baseline-snapshot> [latest-snapshot]");
    process.exit(1);
  }

  const baseline = readSnapshot(baselinePath);
  const latest = readSnapshot(latestPath);
  const comparisons = compareSearchLatencyAgainstBaseline(baseline, latest);

  console.log(
    JSON.stringify(
      {
        baselinePath: path.resolve(process.cwd(), baselinePath),
        latestPath: path.resolve(process.cwd(), latestPath),
        comparisons,
      },
      null,
      2,
    ),
  );

  if (comparisons.some((comparison) => comparison.withinThreshold === false)) {
    process.exit(1);
  }
}

main();
