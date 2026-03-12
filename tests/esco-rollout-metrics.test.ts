import { describe, expect, it } from "vitest";
import {
  bucketConfidenceDistribution,
  buildEscoRolloutSnapshot,
  compareSearchLatencyAgainstBaseline,
  computePercentile,
  summarizeSearchScenario,
} from "../src/services/esco-rollout-metrics.js";

describe("computePercentile", () => {
  it("returns null for empty samples", () => {
    expect(computePercentile([], 95)).toBeNull();
  });

  it("returns the nearest-rank percentile for sorted latency samples", () => {
    expect(computePercentile([120, 90, 150, 110, 100], 50)).toBe(110);
    expect(computePercentile([120, 90, 150, 110, 100], 95)).toBe(150);
  });
});

describe("summarizeSearchScenario", () => {
  it("computes p50 and p95 latency summaries", () => {
    expect(
      summarizeSearchScenario({
        name: "developer-with-esco",
        durationsMs: [92, 110, 135, 121, 108],
      }),
    ).toEqual({
      name: "developer-with-esco",
      runs: 5,
      p50Ms: 110,
      p95Ms: 135,
    });
  });
});

describe("bucketConfidenceDistribution", () => {
  it("groups confidence values into rollout-friendly buckets", () => {
    expect(bucketConfidenceDistribution([null, 0.45, 0.7, 0.82, 0.94])).toEqual({
      unknown: 1,
      low: 1,
      medium: 2,
      high: 1,
    });
  });
});

describe("buildEscoRolloutSnapshot", () => {
  it("summarizes models, fallback reasoning, and top-3 candidate snapshots per job", () => {
    const snapshot = buildEscoRolloutSnapshot({
      generatedAt: "2026-03-12T16:00:00.000Z",
      matches: [
        {
          jobId: "job-1",
          candidateId: "cand-1",
          matchScore: 91,
          model: "esco-hybrid-v1",
          reasoning: "Strong ESCO overlap",
          createdAt: "2026-03-12T10:00:00.000Z",
        },
        {
          jobId: "job-1",
          candidateId: "cand-2",
          matchScore: 84,
          model: "rule-based-v1",
          reasoning: "ESCO guardrail fallback: lage confidence",
          createdAt: "2026-03-12T10:01:00.000Z",
        },
        {
          jobId: "job-1",
          candidateId: "cand-3",
          matchScore: 79,
          model: "esco-rule-v1",
          reasoning: "Canonical skills matched",
          createdAt: "2026-03-12T10:02:00.000Z",
        },
        {
          jobId: "job-2",
          candidateId: "cand-4",
          matchScore: 88,
          model: "hybrid-v1",
          reasoning: "Legacy hybrid baseline",
          createdAt: "2026-03-12T10:03:00.000Z",
        },
      ],
      mappingConfidences: [null, 0.61, 0.78, 0.93],
      searchScenarios: [
        {
          name: "developer",
          durationsMs: [95, 102, 110, 120, 130],
        },
      ],
    });

    expect(snapshot).toMatchObject({
      generatedAt: "2026-03-12T16:00:00.000Z",
      totalMatches: 4,
      guardrailFallbackCount: 1,
      guardrailFallbackRate: 0.25,
      mappingConfidenceDistribution: {
        unknown: 1,
        low: 1,
        medium: 1,
        high: 1,
      },
      byModel: {
        "esco-hybrid-v1": 1,
        "rule-based-v1": 1,
        "esco-rule-v1": 1,
        "hybrid-v1": 1,
      },
      searchLatency: [
        {
          name: "developer",
          runs: 5,
          p50Ms: 110,
          p95Ms: 130,
        },
      ],
    });

    expect(snapshot.top3ByJob).toEqual([
      {
        jobId: "job-1",
        candidateIds: ["cand-1", "cand-2", "cand-3"],
      },
      {
        jobId: "job-2",
        candidateIds: ["cand-4"],
      },
    ]);
  });
});

describe("compareSearchLatencyAgainstBaseline", () => {
  it("reports p95 regression against a stored baseline snapshot", () => {
    const baseline = {
      generatedAt: "2026-03-12T09:00:00.000Z",
      totalMatches: 0,
      byModel: {},
      guardrailFallbackCount: 0,
      guardrailFallbackRate: null,
      mappingConfidenceDistribution: {
        unknown: 0,
        low: 0,
        medium: 0,
        high: 0,
      },
      top3ByJob: [],
      searchLatency: [
        { name: "jobs-query-baseline", runs: 5, p50Ms: 180, p95Ms: 200 },
        { name: "jobs-query-with-esco-filter", runs: 5, p50Ms: 205, p95Ms: 250 },
      ],
    };
    const latest = {
      generatedAt: "2026-03-12T16:00:00.000Z",
      totalMatches: 0,
      byModel: {},
      guardrailFallbackCount: 0,
      guardrailFallbackRate: null,
      mappingConfidenceDistribution: {
        unknown: 0,
        low: 0,
        medium: 0,
        high: 0,
      },
      top3ByJob: [],
      searchLatency: [
        { name: "jobs-query-baseline", runs: 5, p50Ms: 190, p95Ms: 220 },
        { name: "jobs-query-with-esco-filter", runs: 5, p50Ms: 230, p95Ms: 310 },
      ],
    };

    expect(compareSearchLatencyAgainstBaseline(baseline, latest)).toEqual([
      {
        name: "jobs-query-baseline",
        baselineP95Ms: 200,
        latestP95Ms: 220,
        regressionPercent: 10,
        withinThreshold: true,
      },
      {
        name: "jobs-query-with-esco-filter",
        baselineP95Ms: 250,
        latestP95Ms: 310,
        regressionPercent: 24,
        withinThreshold: false,
      },
    ]);
  });
});
