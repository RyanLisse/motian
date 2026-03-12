/**
 * ESCO rollout snapshot artifact.
 * Captures recent match model distribution, fallback signals, review backlog,
 * and representative search latency percentiles for rollout tracking.
 *
 * Run with: pnpm tsx scripts/esco-rollout-snapshot.ts
 * Requires DATABASE_URL (for example via .env.local).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { config as dotenvConfig } from "dotenv";
import { desc, sql } from "drizzle-orm";
import { buildEscoRolloutSnapshot } from "../src/services/esco-rollout-metrics";

dotenvConfig({ path: ".env.local" });

async function measureScenario(
  name: string,
  runSearch: () => Promise<unknown>,
  runs = 5,
): Promise<{ name: string; durationsMs: number[] }> {
  const durationsMs: number[] = [];

  for (let i = 0; i < runs; i += 1) {
    const startedAt = Date.now();
    await runSearch();
    durationsMs.push(Date.now() - startedAt);
  }

  return { name, durationsMs };
}

async function main() {
  const [
    { db },
    { jobMatches, jobSkills, skillMappings },
    { getEscoMappingStats, getReviewQueueSummary, listEscoSkillsForFilter },
    { searchJobsUnified },
  ] = await Promise.all([
    import("../src/db"),
    import("../src/db/schema"),
    import("../src/services/esco"),
    import("../src/services/jobs"),
  ]);

  const [
    recentMatches,
    mapping,
    reviewQueue,
    skillOptions,
    jobSkillFallbackRows,
    mappingConfidenceRows,
  ] = await Promise.all([
    db
      .select({
        jobId: jobMatches.jobId,
        candidateId: jobMatches.candidateId,
        matchScore: jobMatches.matchScore,
        model: jobMatches.model,
        reasoning: jobMatches.reasoning,
        createdAt: jobMatches.createdAt,
      })
      .from(jobMatches)
      .orderBy(desc(jobMatches.createdAt))
      .limit(200),
    getEscoMappingStats(),
    getReviewQueueSummary(),
    listEscoSkillsForFilter(),
    db
      .selectDistinct({
        escoUri: jobSkills.escoUri,
      })
      .from(jobSkills)
      .where(sql`${jobSkills.escoUri} IS NOT NULL`)
      .limit(1),
    db
      .select({
        confidence: skillMappings.confidence,
      })
      .from(skillMappings)
      .limit(5_000),
  ]);

  const representativeSkill = skillOptions[0]?.uri ?? jobSkillFallbackRows[0]?.escoUri ?? null;
  const representativeSkillSource = skillOptions[0]?.uri
    ? "esco-skills"
    : jobSkillFallbackRows[0]?.escoUri
      ? "job-skills"
      : null;
  const searchScenarios = [
    await measureScenario("jobs-query-baseline", () =>
      searchJobsUnified({ q: "developer", limit: 10 }),
    ),
  ];

  if (representativeSkill) {
    searchScenarios.push(
      await measureScenario("jobs-query-with-esco-filter", () =>
        searchJobsUnified({ q: "developer", escoUri: representativeSkill, limit: 10 }),
      ),
    );
    searchScenarios.push(
      await measureScenario("jobs-list-with-esco-filter", () =>
        searchJobsUnified({ escoUri: representativeSkill, limit: 10 }),
      ),
    );
  }

  const snapshot = {
    ...buildEscoRolloutSnapshot({
      matches: recentMatches,
      mappingConfidences: mappingConfidenceRows.map((row) => row.confidence),
      searchScenarios,
    }),
    representativeSkill,
    representativeSkillSource,
    availableSkillOptionCount: skillOptions.length,
    mapping,
    reviewQueue,
  };

  const outDir = path.join(process.cwd(), "docs", "metrics");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "esco-rollout-snapshot-latest.json");
  fs.writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(snapshot, null, 2));
  console.log(`\nWrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
