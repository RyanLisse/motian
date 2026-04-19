import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("overlapGroups schema", () => {
  it("exports overlapGroups table from schema", async () => {
    const schema = await import("../packages/db/src/schema");
    expect(schema.overlapGroups).toBeDefined();
    expect(typeof schema.overlapGroups).toBe("object");
  });

  it("has expected columns: id, totalGroups, groups, computedAt", async () => {
    const schema = await import("../packages/db/src/schema");
    const table = schema.overlapGroups;

    expect(table.id).toBeDefined();
    expect(table.totalGroups).toBeDefined();
    expect(table.groups).toBeDefined();
    expect(table.computedAt).toBeDefined();
  });
});

describe("migration file 0024_overlap_groups.sql", () => {
  const migrationPath = resolve(__dirname, "../drizzle/0024_overlap_groups.sql");

  it("exists", () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it("contains CREATE TABLE for overlap_groups", () => {
    const content = readFileSync(migrationPath, "utf-8");
    expect(content).toContain('CREATE TABLE IF NOT EXISTS "overlap_groups"');
  });

  it("contains index on computed_at", () => {
    const content = readFileSync(migrationPath, "utf-8");
    expect(content).toContain("idx_overlap_groups_computed_at");
  });
});

describe("trigger task scraper-overlap-precompute", () => {
  it("exports scraperOverlapPrecomputeTask", async () => {
    const mod = await import("../trigger/scraper-overlap-precompute");
    expect(mod.scraperOverlapPrecomputeTask).toBeDefined();
    expect(mod.scraperOverlapPrecomputeTask.id).toBe("scraper-overlap-precompute");
  });
});
