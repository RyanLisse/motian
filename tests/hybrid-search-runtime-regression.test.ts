import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockBuildJobFilterConditions,
  mockFetchDedupedJobIds,
  mockFindSimilarJobsByEmbedding,
  mockGenerateQueryEmbedding,
  mockGetHybridSearchPolicy,
  mockLoadJobsByIds,
  mockSelect,
  mockWhere,
} = vi.hoisted(() => {
  const mockWhere = vi.fn();
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));

  return {
    mockBuildJobFilterConditions: vi.fn(),
    mockFetchDedupedJobIds: vi.fn(),
    mockFindSimilarJobsByEmbedding: vi.fn(),
    mockGenerateQueryEmbedding: vi.fn(),
    mockGetHybridSearchPolicy: vi.fn(),
    mockLoadJobsByIds: vi.fn(),
    mockSelect,
    mockWhere,
  };
});

vi.mock("../src/db", async (importOriginal) => ({
  ...(await importOriginal()),
  db: {
    select: mockSelect,
  },
}));

vi.mock("../src/db/schema", () => ({
  jobs: {
    id: "jobs.id",
    title: "jobs.title",
    company: "jobs.company",
    endClient: "jobs.endClient",
    description: "jobs.description",
    location: "jobs.location",
    province: "jobs.province",
    scrapedAt: "jobs.scrapedAt",
    rateMin: "jobs.rateMin",
    rateMax: "jobs.rateMax",
    applicationDeadline: "jobs.applicationDeadline",
    postedAt: "jobs.postedAt",
    startDate: "jobs.startDate",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ type: "and", args }),
  ilike: (...args: unknown[]) => ({ type: "ilike", args }),
  inArray: (...args: unknown[]) => ({ type: "inArray", args }),
  or: (...args: unknown[]) => ({ type: "or", args }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ type: "sql", strings, values }),
}));

vi.mock("../src/services/jobs/list", () => ({
  listJobs: vi.fn(),
}));

vi.mock("../src/services/jobs/filters", () => ({
  getJobStatusCondition: vi.fn(() => ({ type: "status-condition" })),
  getSortComparator: vi.fn(() => () => 0),
}));

vi.mock("../src/services/jobs/query-filters", () => ({
  buildJobFilterConditions: mockBuildJobFilterConditions,
}));

vi.mock("../src/services/jobs/hybrid-search-policy", () => ({
  getHybridSearchPolicy: mockGetHybridSearchPolicy,
}));

vi.mock("../src/services/jobs/repository", () => {
  const sel = { id: "jobs.id" };
  return { jobReadSelection: sel, getJobReadSelection: () => sel };
});

vi.mock("../src/services/jobs/deduplication", async () => {
  const actual = await vi.importActual<typeof import("../src/services/jobs/deduplication")>(
    "../src/services/jobs/deduplication",
  );

  return {
    ...actual,
    fetchDedupedJobIds: mockFetchDedupedJobIds,
    loadJobsByIds: mockLoadJobsByIds,
  };
});

vi.mock("../src/services/embedding", () => ({
  getQueryEmbeddingSignal: vi.fn((query: string) => ({
    normalizedQuery: query.trim().toLowerCase(),
    characterCount: query.trim().length,
    termCount: query.trim() ? query.trim().split(/\s+/).length : 0,
  })),
  findSimilarJobsByEmbedding: mockFindSimilarJobsByEmbedding,
  generateQueryEmbedding: mockGenerateQueryEmbedding,
}));

vi.mock("../src/lib/query-observability", () => ({
  SEARCH_SLO_MS: 800,
  logSlowQuery: vi.fn(),
}));

import { hybridSearchWithTotal } from "../src/services/jobs/search";

function containsNode(node: unknown, predicate: (value: unknown) => boolean): boolean {
  if (predicate(node)) return true;
  if (Array.isArray(node)) return node.some((item) => containsNode(item, predicate));
  if (node && typeof node === "object") {
    return Object.values(node).some((value) => containsNode(value, predicate));
  }
  return false;
}

describe("hybridSearchWithTotal runtime regression", () => {
  const job = {
    id: "job-1",
    title: "Informatieanalist",
    company: "Gemeente Utrecht",
    endClient: "Gemeente Utrecht",
    location: "Utrecht",
    province: "Utrecht",
    platform: "opdrachtoverheid",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.HYBRID_SEARCH_ALLOW_SHORT_VECTOR;
    delete process.env.HYBRID_SEARCH_PAGE_ONLY_HYDRATION;
    mockBuildJobFilterConditions.mockReturnValue([]);
    mockGetHybridSearchPolicy.mockImplementation(({ limit = 20, offset = 0 }) => ({
      version: 2,
      fetchSize: Math.min(Math.max((offset + limit) * 3, limit * 3), 100),
      k: 60,
      vectorMinScore: 0.3,
      hydrationMode: "full-candidates",
      shouldRunVectorSearch: true,
      vectorSearchSkippedReason: null,
    }));
    mockFetchDedupedJobIds.mockResolvedValue([job.id]);
    mockLoadJobsByIds.mockResolvedValue([job]);
    mockGenerateQueryEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    mockFindSimilarJobsByEmbedding.mockResolvedValue([]);
    mockWhere.mockResolvedValue([job]);
  });

  it("handles incremental non-empty queries without throwing and returns the compat-selected job", async () => {
    const queries = ["in", "inf", "info", "informatie"];

    for (const query of queries) {
      await expect(hybridSearchWithTotal(query, { limit: 5 })).resolves.toMatchObject({
        total: 1,
        data: [
          expect.objectContaining({ id: job.id, title: job.title, score: expect.any(Number) }),
        ],
      });
    }

    expect(mockFetchDedupedJobIds).toHaveBeenCalledTimes(queries.length);
    expect(mockSelect).toHaveBeenCalledTimes(queries.length);
    expect(mockGenerateQueryEmbedding.mock.calls.map(([query]) => query)).toEqual(queries);
    expect(mockFindSimilarJobsByEmbedding).toHaveBeenCalledTimes(queries.length);
    expect(mockGetHybridSearchPolicy).toHaveBeenNthCalledWith(
      1,
      { query: "in", limit: 5, offset: 0 },
      process.env,
    );
  });

  it("applies shared filters before hydration for both text and vector retrieval", async () => {
    const sharedFilter = { type: "shared-filter", label: "province-filter" };
    mockBuildJobFilterConditions.mockReturnValue([sharedFilter]);

    await hybridSearchWithTotal("informatie", {
      limit: 5,
      province: "Utrecht",
    });

    const textWhereClause = mockFetchDedupedJobIds.mock.calls[0]?.[0]?.whereClause;
    const vectorFilterCondition =
      mockFindSimilarJobsByEmbedding.mock.calls[0]?.[1]?.filterCondition;

    expect(containsNode(textWhereClause, (value) => value === sharedFilter)).toBe(true);
    expect(containsNode(vectorFilterCondition, (value) => value === sharedFilter)).toBe(true);
  });
});
