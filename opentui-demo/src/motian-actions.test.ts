import { describe, expect, it } from "bun:test";
import { computeOldestRetentionDate, summarizeImportResults } from "./motian-summary";

describe("summarizeImportResults", () => {
  it("counts successful and failed platforms and sums new jobs", () => {
    const summary = summarizeImportResults([
      {
        status: "fulfilled",
        value: { jobsNew: 5, duplicates: 1, errors: [] },
      },
      {
        status: "fulfilled",
        value: { jobsNew: 2, duplicates: 0, errors: ["partial failure"] },
      },
      {
        status: "rejected",
        reason: new Error("network"),
      },
    ]);

    expect(summary.totalPlatforms).toBe(3);
    expect(summary.successfulPlatforms).toBe(1);
    expect(summary.failedPlatforms).toBe(2);
    expect(summary.jobsNew).toBe(7);
  });
});

describe("computeOldestRetentionDate", () => {
  it("returns null for empty inputs", () => {
    expect(computeOldestRetentionDate([])).toBeNull();
  });

  it("returns the oldest date", () => {
    const oldest = computeOldestRetentionDate([
      { dataRetentionUntil: new Date("2025-03-01T00:00:00.000Z") },
      { dataRetentionUntil: new Date("2024-11-10T00:00:00.000Z") },
      { dataRetentionUntil: new Date("2026-01-20T00:00:00.000Z") },
    ]);

    expect(oldest?.toISOString()).toBe("2024-11-10T00:00:00.000Z");
  });
});
