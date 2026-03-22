import { afterEach, describe, expect, it, vi } from "vitest";

const GOLDEN_HARNESS_MODULES = [
  "../src/services/jobs/search",
  "../src/db",
  "../src/db/schema",
  "drizzle-orm",
  "../src/services/jobs/list",
  "../src/services/jobs/filters",
  "../src/services/jobs/hybrid-search-policy",
  "../src/services/jobs/query-filters",
  "../src/services/jobs/repository",
  "../src/services/jobs/deduplication",
  "../src/services/embedding",
  "../src/lib/query-observability",
] as const;

function resetGoldenHarnessModules() {
  for (const modulePath of GOLDEN_HARNESS_MODULES) {
    vi.doUnmock(modulePath);
  }
}

type GoldenJob = {
  id: string;
  title: string;
  company: string;
  endClient: string;
  location: string;
  province: string;
  platform: string;
};

type GoldenVectorResult = { id: string; title: string; similarity: number };

async function importHybridSearchGoldenHarness({
  hydratedJobs,
  textResultIds,
  vectorResults,
  policyOverrides,
}: {
  hydratedJobs: GoldenJob[];
  textResultIds: string[];
  vectorResults: GoldenVectorResult[];
  policyOverrides?: Partial<{
    hydrationMode: "full-candidates" | "deduped-vacancy-candidates";
    shouldRunVectorSearch: boolean;
    vectorSearchSkippedReason: "short-query-text-only" | null;
  }>;
}) {
  vi.resetModules();
  resetGoldenHarnessModules();

  const mockWhere = vi.fn().mockResolvedValue(hydratedJobs);
  const mockSelect = vi.fn(() => ({ from: vi.fn(() => ({ where: mockWhere })) }));
  const mockLoadJobsByIds = vi.fn().mockImplementation(async (ids: string[]) => {
    const jobById = new Map(hydratedJobs.map((job) => [job.id, job]));
    return ids.map((id) => jobById.get(id)).filter((job): job is GoldenJob => Boolean(job));
  });

  vi.doMock("../src/db", async () => {
    const actual = await import("../src/db");
    return {
      db: { select: mockSelect },
      // Re-export actual Drizzle helpers
      sql: actual.sql,
      and: actual.and,
      like: actual.like,
      inArray: actual.inArray,
      or: actual.or,
      isPostgresDatabase: actual.isPostgresDatabase,
    };
  });
  vi.doMock("../src/db/schema", () => ({
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
  vi.doMock("drizzle-orm", () => ({
    and: (...args: unknown[]) => ({ type: "and", args }),
    like: (...args: unknown[]) => ({ type: "like", args }),
    inArray: (...args: unknown[]) => ({ type: "inArray", args }),
    or: (...args: unknown[]) => ({ type: "or", args }),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: "sql",
      strings,
      values,
    }),
  }));
  vi.doMock("../src/services/jobs/list", () => ({ listJobs: vi.fn() }));
  vi.doMock("../src/services/jobs/filters", () => ({
    getJobStatusCondition: vi.fn(() => ({ type: "status-condition" })),
    getSortComparator: vi.fn(() => () => 0),
  }));
  vi.doMock("../src/services/jobs/hybrid-search-policy", () => ({
    getHybridSearchPolicy: vi.fn(({ limit = 20, offset = 0 }) => ({
      version: 2,
      fetchSize: Math.min(Math.max((offset + limit) * 3, limit * 3), 100),
      k: 60,
      vectorMinScore: 0.3,
      hydrationMode: policyOverrides?.hydrationMode ?? "full-candidates",
      shouldRunVectorSearch: policyOverrides?.shouldRunVectorSearch ?? true,
      vectorSearchSkippedReason: policyOverrides?.vectorSearchSkippedReason ?? null,
    })),
  }));
  vi.doMock("../src/services/jobs/query-filters", () => ({
    buildJobFilterConditions: vi.fn(() => []),
  }));
  vi.doMock("../src/services/jobs/repository", () => {
    const sel = { id: "jobs.id" };
    return { jobReadSelection: sel, getJobReadSelection: () => sel };
  });
  vi.doMock("../src/services/jobs/deduplication", () => ({
    collapseScoredJobsByVacancy: vi.fn((entries: unknown[]) => entries),
    fetchDedupedJobIds: vi.fn().mockResolvedValue(textResultIds),
    loadJobsByIds: mockLoadJobsByIds,
  }));
  vi.doMock("../src/services/embedding", () => ({
    getQueryEmbeddingSignal: vi.fn((query: string) => ({
      normalizedQuery: query.trim().toLowerCase(),
      characterCount: query.trim().length,
      termCount: query.trim() ? query.trim().split(/\s+/).length : 0,
    })),
    generateQueryEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    findSimilarJobsByEmbedding: vi.fn().mockResolvedValue(vectorResults),
  }));
  vi.doMock("../src/lib/query-observability", () => ({
    SEARCH_SLO_MS: 800,
    logSlowQuery: vi.fn(),
  }));

  const mod = await import("../src/services/jobs/search");
  return { ...mod, mockLoadJobsByIds };
}

describe("hybrid search golden queries", () => {
  const hydratedJobs: GoldenJob[] = [
    {
      id: "job-1",
      title: "Informatiebeheer specialist",
      company: "Motian",
      endClient: "Gemeente Utrecht",
      location: "Utrecht",
      province: "Utrecht",
      platform: "opdrachtoverheid",
    },
    {
      id: "job-2",
      title: "Senior informatiebeheer consultant",
      company: "Motian",
      endClient: "Gemeente Utrecht",
      location: "Utrecht",
      province: "Utrecht",
      platform: "opdrachtoverheid",
    },
    {
      id: "job-3",
      title: "Archiefmedewerker",
      company: "Motian",
      endClient: "Gemeente Utrecht",
      location: "Utrecht",
      province: "Utrecht",
      platform: "opdrachtoverheid",
    },
    {
      id: "job-4",
      title: "Records manager",
      company: "Motian",
      endClient: "Gemeente Utrecht",
      location: "Utrecht",
      province: "Utrecht",
      platform: "opdrachtoverheid",
    },
  ];

  afterEach(() => {
    resetGoldenHarnessModules();
    vi.resetModules();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("keeps the current ranked prefix and score rounding for the golden informatiebeheer query", async () => {
    const { hybridSearchWithTotal } = await importHybridSearchGoldenHarness({
      hydratedJobs,
      textResultIds: ["job-1", "job-2", "job-3"],
      vectorResults: [
        { id: "job-2", title: hydratedJobs[1].title, similarity: 0.93 },
        { id: "job-4", title: hydratedJobs[3].title, similarity: 0.88 },
        { id: "job-1", title: hydratedJobs[0].title, similarity: 0.84 },
      ],
    });

    await expect(hybridSearchWithTotal("informatiebeheer", { limit: 4 })).resolves.toEqual({
      total: 4,
      data: [
        expect.objectContaining({ id: "job-2", score: 0.0325 }),
        expect.objectContaining({ id: "job-1", score: 0.0323 }),
        expect.objectContaining({ id: "job-4", score: 0.0161 }),
        expect.objectContaining({ id: "job-3", score: 0.0159 }),
      ],
    });
  });

  it("preserves total-count and offset semantics for the same golden ranking baseline", async () => {
    const { hybridSearchWithTotal } = await importHybridSearchGoldenHarness({
      hydratedJobs,
      textResultIds: ["job-1", "job-2", "job-3"],
      vectorResults: [
        { id: "job-2", title: hydratedJobs[1].title, similarity: 0.93 },
        { id: "job-4", title: hydratedJobs[3].title, similarity: 0.88 },
        { id: "job-1", title: hydratedJobs[0].title, similarity: 0.84 },
      ],
    });

    const result = await hybridSearchWithTotal("informatiebeheer", { limit: 1, offset: 1 });

    expect(result.total).toBe(4);
    expect(result.data).toEqual([expect.objectContaining({ id: "job-1", score: 0.0323 })]);
  });

  it("keeps ranking drift within the approved one-slot bound for golden queries", async () => {
    const { hybridSearchWithTotal } = await importHybridSearchGoldenHarness({
      hydratedJobs,
      textResultIds: ["job-1", "job-2", "job-3"],
      vectorResults: [
        { id: "job-2", title: hydratedJobs[1].title, similarity: 0.93 },
        { id: "job-1", title: hydratedJobs[0].title, similarity: 0.89 },
        { id: "job-4", title: hydratedJobs[3].title, similarity: 0.88 },
      ],
    });

    const result = await hybridSearchWithTotal("informatiebeheer", { limit: 4 });
    const ids = result.data.map((item) => item.id);
    const baseline = ["job-2", "job-1", "job-4", "job-3"];

    for (const [baselineRank, id] of baseline.entries()) {
      const actualRank = ids.indexOf(id);
      expect(actualRank).toBeGreaterThanOrEqual(0);
      expect(Math.abs(actualRank - baselineRank)).toBeLessThanOrEqual(1);
    }
  });

  it("keeps the approved ordering while reduced hydration only loads the requested page", async () => {
    const { hybridSearchWithTotal, mockLoadJobsByIds } = await importHybridSearchGoldenHarness({
      hydratedJobs,
      textResultIds: ["job-1", "job-2", "job-3"],
      vectorResults: [
        { id: "job-2", title: hydratedJobs[1].title, similarity: 0.93 },
        { id: "job-4", title: hydratedJobs[3].title, similarity: 0.88 },
        { id: "job-1", title: hydratedJobs[0].title, similarity: 0.84 },
      ],
      policyOverrides: { hydrationMode: "deduped-vacancy-candidates" },
    });

    const result = await hybridSearchWithTotal("informatiebeheer", { limit: 2, offset: 0 });

    expect(result.total).toBe(4);
    expect(result.data).toEqual([
      expect.objectContaining({ id: "job-2", score: 0.0325 }),
      expect.objectContaining({ id: "job-1", score: 0.0323 }),
    ]);
    expect(mockLoadJobsByIds).toHaveBeenCalledWith(["job-2", "job-1"]);
  });
});
