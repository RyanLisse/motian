import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("dedupe fast path stale behavior", () => {
  it("keeps using the fast path when dedupe ranks exist but are stale", () => {
    const source = readFileSync(
      resolve(__dirname, "../src/services/jobs/deduplication.ts"),
      "utf-8",
    );

    expect(source).toContain("const { computedAt, isFresh } = await getDedupeRanksFreshness()");
    expect(source).toContain("if (computedAt) {");
    expect(source).toContain("if (!isFresh) {");
    expect(source).toContain("scheduleDedupeRankRefresh();");
    expect(source).toContain(
      "return fetchDedupedJobsPageFast({ whereClause, limit, offset, sortBy, knownTotal });",
    );
  });
});
