import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockFetchDedupedJobIds,
  mockFindSimilarJobsByEmbedding,
  mockGenerateQueryEmbedding,
  mockLogSlowQuery,
  mockSelect,
} = vi.hoisted(() => ({
  mockFetchDedupedJobIds: vi.fn(),
  mockFindSimilarJobsByEmbedding: vi.fn(),
  mockGenerateQueryEmbedding: vi.fn(),
  mockLogSlowQuery: vi.fn(),
  mockSelect: vi.fn(),
}));

vi.mock("../src/db", () => ({ db: { select: mockSelect } }));

vi.mock("../src/db/schema", () => ({
  jobs: {
    id: "jobs.id",
    title: "jobs.title",
    company: "jobs.company",
    description: "jobs.description",
    location: "jobs.location",
    province: "jobs.province",
    scrapedAt: "jobs.scrapedAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ type: "and", args }),
  ilike: (...args: unknown[]) => ({ type: "ilike", args }),
  inArray: (...args: unknown[]) => ({ type: "inArray", args }),
  or: (...args: unknown[]) => ({ type: "or", args }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ type: "sql", strings, values }),
}));

vi.mock("../src/services/jobs/list", () => ({ listJobs: vi.fn() }));

vi.mock("../src/services/jobs/filters", () => ({
  getJobStatusCondition: vi.fn(() => ({ type: "status-condition" })),
  getSortComparator: vi.fn(() => () => 0),
}));

vi.mock("../src/services/jobs/hybrid-search-policy", () => ({
  getHybridSearchPolicy: vi.fn(({ limit = 20, offset = 0 }) => ({
    version: 2,
    fetchSize: Math.min(Math.max((offset + limit) * 3, limit * 3), 100),
    k: 60,
    vectorMinScore: 0.3,
    hydrationMode: "full-candidates",
    shouldRunVectorSearch: true,
    vectorSearchSkippedReason: null,
  })),
}));

vi.mock("../src/services/jobs/query-filters", () => ({
  buildJobFilterConditions: vi.fn(() => []),
}));

vi.mock("../src/services/jobs/repository", () => ({
  jobReadSelection: { id: "jobs.id" },
}));

vi.mock("../src/services/jobs/deduplication", () => ({
  collapseScoredJobsByVacancy: vi.fn((entries: unknown[]) => entries),
  fetchDedupedJobIds: mockFetchDedupedJobIds,
  loadJobsByIds: vi.fn(),
}));

vi.mock("../src/services/embedding", async () => {
  const actual = await vi.importActual<typeof import("../src/services/embedding")>(
    "../src/services/embedding",
  );

  return {
    ...actual,
    findSimilarJobsByEmbedding: mockFindSimilarJobsByEmbedding,
    generateQueryEmbedding: mockGenerateQueryEmbedding,
  };
});

vi.mock("../src/lib/query-observability", () => ({
  SEARCH_SLO_MS: 800,
  logSlowQuery: mockLogSlowQuery,
}));

import { hybridSearchWithTotal } from "../src/services/jobs/search";

function mockIncreasingNow(stepMs: number) {
  let current = 1_000;
  return vi.spyOn(Date, "now").mockImplementation(() => {
    current += stepMs;
    return current;
  });
}

describe("hybridSearch stage timings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([
          {
            id: "job-1",
            title: "Informatiebeheer specialist",
            company: "Motian",
            endClient: "Gemeente Utrecht",
            location: "Utrecht",
            province: "Utrecht",
            platform: "opdrachtoverheid",
          },
        ]),
      })),
    });
    mockFetchDedupedJobIds.mockResolvedValue(["job-1"]);
    mockGenerateQueryEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    mockFindSimilarJobsByEmbedding.mockResolvedValue([
      { id: "job-1", title: "Informatiebeheer specialist", similarity: 0.9 },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits all Phase 1 telemetry stage keys through logSlowQuery", async () => {
    mockIncreasingNow(150);

    await hybridSearchWithTotal("informatiebeheer", { limit: 5, offset: 2 });

    expect(mockLogSlowQuery).toHaveBeenCalledTimes(1);
    const [operation, durationMs, thresholdMs, payload] = mockLogSlowQuery.mock.calls[0] ?? [];

    expect(operation).toBe("hybridSearch");
    expect(durationMs).toEqual(expect.any(Number));
    expect(thresholdMs).toBe(800);
    expect(payload).toEqual(
      expect.objectContaining({
        query: "informatiebeheer",
        offset: 2,
        total: 1,
        results: 0,
        textSearchMs: expect.any(Number),
        embeddingMs: expect.any(Number),
        vectorSearchMs: expect.any(Number),
        rrfMs: expect.any(Number),
        hydrateMs: expect.any(Number),
        dedupeMs: expect.any(Number),
      }),
    );
  });
});
