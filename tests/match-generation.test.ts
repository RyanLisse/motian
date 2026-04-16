import { beforeEach, describe, expect, it, vi } from "vitest";

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, reject, resolve };
}

const {
  mockComputeMatchScore,
  mockCreateMatch,
  mockGetCandidatesByIds,
  mockGetJobById,
  mockListActiveCandidates,
} = vi.hoisted(() => ({
  mockComputeMatchScore: vi.fn(),
  mockCreateMatch: vi.fn(),
  mockGetCandidatesByIds: vi.fn(),
  mockGetJobById: vi.fn(),
  mockListActiveCandidates: vi.fn(),
}));

vi.mock("../src/services/jobs", () => ({
  getJobById: mockGetJobById,
}));

vi.mock("../src/services/candidates", () => ({
  getCandidatesByIds: mockGetCandidatesByIds,
  listActiveCandidates: mockListActiveCandidates,
}));

vi.mock("../src/services/matches", () => ({
  createMatch: mockCreateMatch,
}));

vi.mock("../src/services/scoring", () => ({
  computeMatchScore: mockComputeMatchScore,
}));

import { generateMatchesForJob } from "../src/services/match-generation";

describe("generateMatchesForJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts top-match inserts concurrently and preserves duplicate/error bookkeeping", async () => {
    const job = { id: "job-1" };
    const candidates = [{ id: "cand-2" }, { id: "cand-4" }, { id: "cand-1" }, { id: "cand-3" }];
    const scores = {
      "cand-1": { confidence: 0.97, model: "test-model", reasoning: "best", score: 91 },
      "cand-2": { confidence: 0.9, model: "test-model", reasoning: "duplicate", score: 82 },
      "cand-3": { confidence: 0.81, model: "test-model", reasoning: "error", score: 75 },
      "cand-4": { confidence: 0.4, model: "test-model", reasoning: "below-limit", score: 12 },
    };
    const deferredResults = [
      createDeferred<{ id: string }>(),
      createDeferred<{ id: string }>(),
      createDeferred<{ id: string }>(),
    ];
    let createMatchCallIndex = 0;

    mockGetJobById.mockResolvedValue(job);
    mockListActiveCandidates.mockResolvedValue(candidates);
    mockComputeMatchScore.mockImplementation((_job, candidate: { id: keyof typeof scores }) => {
      return scores[candidate.id];
    });
    mockCreateMatch.mockImplementation(() => {
      const deferred = deferredResults[createMatchCallIndex];
      createMatchCallIndex += 1;
      return deferred.promise;
    });

    const resultPromise = generateMatchesForJob({ jobId: job.id, limit: 3 });

    await Promise.resolve();
    await Promise.resolve();

    expect(mockCreateMatch).toHaveBeenCalledTimes(3);
    expect(mockCreateMatch.mock.calls.map(([payload]) => payload)).toEqual([
      {
        candidateId: "cand-1",
        confidence: 0.97,
        jobId: "job-1",
        matchScore: 91,
        model: "test-model",
        reasoning: "best",
      },
      {
        candidateId: "cand-2",
        confidence: 0.9,
        jobId: "job-1",
        matchScore: 82,
        model: "test-model",
        reasoning: "duplicate",
      },
      {
        candidateId: "cand-3",
        confidence: 0.81,
        jobId: "job-1",
        matchScore: 75,
        model: "test-model",
        reasoning: "error",
      },
    ]);

    deferredResults[0].resolve({ id: "match-1" });
    deferredResults[1].reject(new Error("duplicate key value violates unique constraint"));
    deferredResults[2].reject(new Error("db unavailable"));

    await expect(resultPromise).resolves.toEqual({
      duplicateMatches: 1,
      errors: ["Kandidaat cand-3: Error: db unavailable"],
      jobId: "job-1",
      matchesCreated: 1,
      topScore: 91,
      totalCandidatesScored: 4,
    });
  });

  it("uses targeted candidate IDs when provided", async () => {
    const job = { id: "job-1" };
    const candidates = [{ id: "cand-a" }, { id: "cand-b" }];

    mockGetJobById.mockResolvedValue(job);
    mockGetCandidatesByIds.mockResolvedValue(candidates);
    mockComputeMatchScore.mockReturnValue({
      confidence: 0.5,
      model: "test-model",
      reasoning: "ok",
      score: 50,
    });
    mockCreateMatch.mockResolvedValue({ id: "match-1" });

    await expect(
      generateMatchesForJob({ candidateIds: ["cand-a", "cand-b"], jobId: job.id, limit: 5 }),
    ).resolves.toEqual({
      duplicateMatches: 0,
      errors: [],
      jobId: "job-1",
      matchesCreated: 2,
      topScore: 50,
      totalCandidatesScored: 2,
    });

    expect(mockGetCandidatesByIds).toHaveBeenCalledWith(["cand-a", "cand-b"]);
    expect(mockListActiveCandidates).not.toHaveBeenCalled();
  });
});
