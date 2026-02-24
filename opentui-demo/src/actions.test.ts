import { describe, expect, it, mock } from "bun:test";
import {
  createTuiActions,
  type ImportJobsSummary,
  type ReviewGdprSummary,
  type RunScoringSummary,
} from "./actions";

describe("createTuiActions", () => {
  it("returns three actions in the expected order", () => {
    const actions = createTuiActions({
      importJobsFromAts: async () =>
        ({
          totalPlatforms: 0,
          successfulPlatforms: 0,
          failedPlatforms: 0,
          jobsNew: 0,
        }) satisfies ImportJobsSummary,
      runCandidateScoring: async () =>
        ({
          jobsProcessed: 0,
          candidatesConsidered: 0,
          matchesCreated: 0,
          duplicateMatches: 0,
          errors: 0,
        }) satisfies RunScoringSummary,
      reviewGdprRequests: async () =>
        ({
          expiredCandidates: 0,
          oldestRetentionDate: null,
        }) satisfies ReviewGdprSummary,
    });

    expect(actions.map((action) => action.id)).toEqual([
      "import_jobs",
      "run_scoring",
      "review_gdpr",
    ]);
  });

  it("wires import action to the import dependency", async () => {
    const importJobsFromAts = mock(async () => {
      return {
        totalPlatforms: 3,
        successfulPlatforms: 2,
        failedPlatforms: 1,
        jobsNew: 27,
      } satisfies ImportJobsSummary;
    });

    const actions = createTuiActions({
      importJobsFromAts,
      runCandidateScoring: async () =>
        ({
          jobsProcessed: 0,
          candidatesConsidered: 0,
          matchesCreated: 0,
          duplicateMatches: 0,
          errors: 0,
        }) satisfies RunScoringSummary,
      reviewGdprRequests: async () =>
        ({
          expiredCandidates: 0,
          oldestRetentionDate: null,
        }) satisfies ReviewGdprSummary,
    });

    const action = actions[0];
    expect(action).toBeDefined();
    if (!action) throw new Error("Expected import action");

    const result = await action.run();

    expect(importJobsFromAts).toHaveBeenCalledTimes(1);
    expect(result.lines).toContain("Nieuwe opdrachten: 27");
  });

  it("wires scoring action to the scoring dependency", async () => {
    const runCandidateScoring = mock(async () => {
      return {
        jobsProcessed: 14,
        candidatesConsidered: 122,
        matchesCreated: 34,
        duplicateMatches: 8,
        errors: 1,
      } satisfies RunScoringSummary;
    });

    const actions = createTuiActions({
      importJobsFromAts: async () =>
        ({
          totalPlatforms: 0,
          successfulPlatforms: 0,
          failedPlatforms: 0,
          jobsNew: 0,
        }) satisfies ImportJobsSummary,
      runCandidateScoring,
      reviewGdprRequests: async () =>
        ({
          expiredCandidates: 0,
          oldestRetentionDate: null,
        }) satisfies ReviewGdprSummary,
    });

    const action = actions[1];
    expect(action).toBeDefined();
    if (!action) throw new Error("Expected scoring action");

    const result = await action.run();

    expect(runCandidateScoring).toHaveBeenCalledTimes(1);
    expect(result.lines).toContain("Matches aangemaakt: 34");
  });

  it("wires GDPR review action to the review dependency", async () => {
    const reviewGdprRequests = mock(async () => {
      return {
        expiredCandidates: 5,
        oldestRetentionDate: new Date("2025-01-01T00:00:00.000Z"),
      } satisfies ReviewGdprSummary;
    });

    const actions = createTuiActions({
      importJobsFromAts: async () =>
        ({
          totalPlatforms: 0,
          successfulPlatforms: 0,
          failedPlatforms: 0,
          jobsNew: 0,
        }) satisfies ImportJobsSummary,
      runCandidateScoring: async () =>
        ({
          jobsProcessed: 0,
          candidatesConsidered: 0,
          matchesCreated: 0,
          duplicateMatches: 0,
          errors: 0,
        }) satisfies RunScoringSummary,
      reviewGdprRequests,
    });

    const action = actions[2];
    expect(action).toBeDefined();
    if (!action) throw new Error("Expected GDPR action");

    const result = await action.run();

    expect(reviewGdprRequests).toHaveBeenCalledTimes(1);
    expect(result.lines).toContain("Verlopen retentie kandidaten: 5");
    expect(result.lines.some((line) => line.includes("Oudste retentiedatum"))).toBe(true);
  });
});
