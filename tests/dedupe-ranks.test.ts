import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("jobDedupeRanks schema", () => {
  it("exports jobDedupeRanks table from schema", async () => {
    const schema = await import("../packages/db/src/schema");
    expect(schema.jobDedupeRanks).toBeDefined();
    expect(typeof schema.jobDedupeRanks).toBe("object");
  });

  it("has expected columns: jobId, dedupeRank, dedupeGroup, computedAt", async () => {
    const schema = await import("../packages/db/src/schema");
    const table = schema.jobDedupeRanks;

    expect(table.jobId).toBeDefined();
    expect(table.dedupeRank).toBeDefined();
    expect(table.dedupeGroup).toBeDefined();
    expect(table.computedAt).toBeDefined();
  });
});

describe("refreshDedupeRanks function shape", () => {
  it("exports refreshDedupeRanks and getDedupeRanksFreshness", async () => {
    const mod = await import("../src/services/jobs/dedupe-ranks");
    expect(typeof mod.refreshDedupeRanks).toBe("function");
    expect(typeof mod.getDedupeRanksFreshness).toBe("function");
  });
});

describe("fetchDedupedJobsPageFast export", () => {
  it("exports fetchDedupedJobsPageFast from deduplication module", async () => {
    const mod = await import("../src/services/jobs/deduplication");
    expect(typeof mod.fetchDedupedJobsPageFast).toBe("function");
  });
});

describe("migration file 0022_job_dedupe_ranks.sql", () => {
  const migrationPath = resolve(__dirname, "../drizzle/0022_job_dedupe_ranks.sql");

  it("exists", () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it("contains CREATE TABLE for job_dedupe_ranks", () => {
    const content = readFileSync(migrationPath, "utf-8");
    expect(content).toContain('CREATE TABLE IF NOT EXISTS "job_dedupe_ranks"');
  });

  it("contains index on dedupe_rank", () => {
    const content = readFileSync(migrationPath, "utf-8");
    expect(content).toContain("idx_job_dedupe_ranks_rank");
  });

  it("contains index on dedupe_group", () => {
    const content = readFileSync(migrationPath, "utf-8");
    expect(content).toContain("idx_job_dedupe_ranks_group");
  });

  it("references jobs table with ON DELETE CASCADE", () => {
    const content = readFileSync(migrationPath, "utf-8");
    expect(content).toContain('REFERENCES "jobs"("id") ON DELETE CASCADE');
  });
});

describe("trigger task cache-refresh (consolidated)", () => {
  it("exports cacheRefreshTask that covers dedupe ranks", async () => {
    const mod = await import("../trigger/cache-refresh");
    expect(mod.cacheRefreshTask).toBeDefined();
    expect(mod.cacheRefreshTask.id).toBe("cache-refresh");
  });
});
