import { afterEach, describe, expect, it, vi } from "vitest";

async function importListJobsPageWithMocks() {
  vi.resetModules();

  const fetchDedupedJobsPage = vi.fn().mockResolvedValue({ ids: ["job-2", "job-1"], total: 7 });
  const loadJobPageRowsByIds = vi.fn().mockResolvedValue([
    {
      id: "job-2",
      title: "Tweede vacature",
      company: "Gemeente Utrecht",
      location: "Utrecht",
      platform: "opdrachtoverheid",
      workArrangement: "hybride",
      contractType: "interim",
      applicationDeadline: null,
      hasPipeline: true,
      pipelineCount: 3,
    },
    {
      id: "job-1",
      title: "Eerste vacature",
      company: "Motian",
      location: "Amsterdam",
      platform: "werkeninfriesland",
      workArrangement: "remote",
      contractType: "vast",
      applicationDeadline: null,
      hasPipeline: false,
      pipelineCount: 0,
    },
  ]);

  vi.doMock("../src/db", async () => ({
    ...(await vi.importActual("../src/db")),
    and: (...args: unknown[]) => ({ type: "and", args }),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: "sql",
      strings,
      values,
    }),
  }));
  vi.doMock("../src/db/schema", () => ({
    jobs: {
      title: "jobs.title",
      company: "jobs.company",
      description: "jobs.description",
      location: "jobs.location",
      province: "jobs.province",
      scrapedAt: "jobs.scrapedAt",
      id: "jobs.id",
    },
  }));
  vi.doMock("../src/lib/helpers", () => ({
    caseInsensitiveContains: (column: unknown, value: unknown) => ({
      type: "ilike",
      column,
      value,
    }),
    toTsQueryInput: vi.fn(() => null),
  }));
  vi.doMock("../src/services/jobs/deduplication", () => ({
    fetchDedupedJobsPage,
    loadJobPageRowsByIds,
  }));
  vi.doMock("../src/services/jobs/query-filters", () => ({
    buildJobFilterConditions: vi.fn(() => []),
  }));

  const mod = await import("../src/services/jobs/page");
  return { listJobsPage: mod.listJobsPage, fetchDedupedJobsPage, loadJobPageRowsByIds };
}

async function importHybridJobsPageWithMocks() {
  vi.resetModules();

  const mockWhere = vi.fn().mockResolvedValue([
    {
      id: "job-2",
      title: "Tweede vacature",
      company: "Gemeente Utrecht",
      endClient: "Gemeente Utrecht",
      location: "Utrecht",
      province: "Utrecht",
      scrapedAt: new Date("2026-03-01"),
      rateMin: 80,
      rateMax: 100,
      applicationDeadline: null,
      postedAt: null,
      startDate: null,
    },
    {
      id: "job-1",
      title: "Eerste vacature",
      company: "Motian",
      endClient: "Motian",
      location: "Amsterdam",
      province: "Noord-Holland",
      scrapedAt: new Date("2026-02-01"),
      rateMin: 60,
      rateMax: 80,
      applicationDeadline: null,
      postedAt: null,
      startDate: null,
    },
  ]);
  const mockSelect = vi.fn(() => ({ from: vi.fn(() => ({ where: mockWhere })) }));
  const loadJobPageRowsByIds = vi.fn().mockResolvedValue([
    {
      id: "job-2",
      title: "Tweede vacature",
      company: "Gemeente Utrecht",
      location: "Utrecht",
      platform: "opdrachtoverheid",
      workArrangement: "hybride",
      contractType: "interim",
      applicationDeadline: null,
      hasPipeline: true,
      pipelineCount: 2,
    },
    {
      id: "job-1",
      title: "Eerste vacature",
      company: "Motian",
      location: "Amsterdam",
      platform: "werkeninfriesland",
      workArrangement: "remote",
      contractType: "vast",
      applicationDeadline: null,
      hasPipeline: false,
      pipelineCount: 0,
    },
  ]);

  vi.doMock("../src/db", async () => ({
    ...(await vi.importActual("../src/db")),
    and: (...args: unknown[]) => ({ type: "and", args }),
    db: {
      select: mockSelect,
    },
    inArray: (column: unknown, values: unknown[]) => ({ type: "inArray", column, values }),
    or: (...args: unknown[]) => ({ type: "or", args }),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: "sql",
      strings,
      values,
    }),
  }));
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
  vi.doMock("../src/lib/helpers", () => ({
    caseInsensitiveContains: (column: unknown, value: unknown) => ({
      type: "ilike",
      column,
      value,
    }),
    toTsQueryInput: vi.fn(() => null),
  }));
  vi.doMock("../src/services/jobs/deduplication", () => ({
    collapseScoredJobsByVacancy: vi.fn((entries: unknown[]) => entries),
    fetchDedupedJobIds: vi.fn().mockResolvedValue(["job-2", "job-1"]),
    loadJobPageRowsByIds,
  }));
  vi.doMock("../src/services/jobs/filters", () => ({
    getSortComparator: vi.fn(() => () => 0),
  }));
  vi.doMock("../src/services/jobs/hybrid-search-policy", () => ({
    getHybridSearchPolicy: vi.fn(() => ({
      version: 2,
      fetchSize: 6,
      k: 60,
      vectorMinScore: 0.3,
      hydrationMode: "deduped-vacancy-candidates",
      shouldRunVectorSearch: false,
      vectorSearchSkippedReason: "short-query",
    })),
  }));
  vi.doMock("../src/services/jobs/query-filters", () => ({
    buildJobFilterConditions: vi.fn(() => []),
  }));
  vi.doMock("../src/services/jobs/search", () => ({
    hybridSearchRankSelection: {},
    rankHybridCandidates: vi.fn((scoreMap: Map<string, { job?: { id: string } }>) =>
      [...scoreMap.values()]
        .filter((entry): entry is { job: { id: string } } => Boolean(entry.job))
        .map((entry) => ({ job: entry.job })),
    ),
    searchJobIdsByTitle: vi.fn().mockResolvedValue({
      ids: ["job-2", "job-1"],
      queryPath: "search-text",
    }),
  }));
  vi.doMock("../src/services/embedding", () => ({
    generateQueryEmbedding: vi.fn(),
    findSimilarJobsByEmbedding: vi.fn(),
    findSimilarJobs: vi.fn(),
  }));

  const mod = await import("../src/services/jobs/page");
  return { hybridSearchJobsPageWithTotal: mod.hybridSearchJobsPageWithTotal, loadJobPageRowsByIds };
}

describe("jobs page service", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("listJobsPage preserves pagination totals, deduped order, and pipeline counts", async () => {
    const { listJobsPage, fetchDedupedJobsPage, loadJobPageRowsByIds } =
      await importListJobsPageWithMocks();

    const result = await listJobsPage({ limit: 2, offset: 5, sortBy: "deadline_desc" });

    expect(fetchDedupedJobsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 2,
        offset: 5,
        sortBy: "deadline_desc",
      }),
    );
    expect(loadJobPageRowsByIds).toHaveBeenCalledWith(["job-2", "job-1"]);
    expect(result).toEqual({
      data: [
        expect.objectContaining({ id: "job-2", pipelineCount: 3, hasPipeline: true }),
        expect.objectContaining({ id: "job-1", pipelineCount: 0, hasPipeline: false }),
      ],
      total: 7,
    });
  }, 15_000);

  it("hybridSearchJobsPageWithTotal preserves ranked page order and pipeline counts", async () => {
    const { hybridSearchJobsPageWithTotal, loadJobPageRowsByIds } =
      await importHybridJobsPageWithMocks();

    const result = await hybridSearchJobsPageWithTotal("manager", {
      limit: 2,
      offset: 0,
      sortBy: "nieuwste",
    });

    expect(loadJobPageRowsByIds).toHaveBeenCalledWith(["job-2", "job-1"]);
    expect(result).toEqual({
      data: [
        expect.objectContaining({ id: "job-2", pipelineCount: 2, hasPipeline: true }),
        expect.objectContaining({ id: "job-1", pipelineCount: 0, hasPipeline: false }),
      ],
      total: 2,
    });
  }, 15_000);
});
