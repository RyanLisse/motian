import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSlowQueryPayload,
  LIST_SLO_MS,
  logSlowQuery,
  SEARCH_SLO_MS,
} from "../src/lib/query-observability";

function createIncreasingNow(stepMs: number) {
  let current = 1_000;
  return vi.spyOn(Date, "now").mockImplementation(() => {
    current += stepMs;
    return current;
  });
}

async function importListJobsWithTelemetryMocks() {
  vi.resetModules();

  const fetchDedupedJobsPage = vi.fn().mockResolvedValue({ ids: ["job-2", "job-1"], total: 2 });
  const loadJobsByIds = vi.fn().mockResolvedValue([
    { id: "job-2", title: "Tweede vacature", platform: "opdrachtoverheid" },
    { id: "job-1", title: "Eerste vacature", platform: "opdrachtoverheid" },
  ]);

  vi.doMock("../src/db", async () => ({
    ...(await import("../src/db")),
    db: {},
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
  vi.doMock("drizzle-orm", () => ({
    and: (...args: unknown[]) => ({ type: "and", args }),
    desc: (column: unknown) => ({ type: "desc", column }),
    ilike: (column: unknown, value: unknown) => ({ type: "ilike", column, value }),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: "sql",
      strings,
      values,
    }),
  }));
  vi.doMock("../src/services/jobs/deduplication", () => ({
    fetchDedupedJobsPage,
    loadJobsByIds,
  }));
  vi.doMock("../src/services/jobs/query-filters", () => ({
    buildJobFilterConditions: vi.fn(() => []),
  }));
  vi.doMock("../src/services/jobs/filters", () => ({
    getJobStatusCondition: vi.fn(() => ({ type: "status-condition" })),
  }));
  vi.doMock("../src/services/jobs/repository", () => ({
    jobReadSelection: { id: "jobs.id" },
  }));

  const mod = await import("../src/services/jobs/list");
  return { listJobs: mod.listJobs, fetchDedupedJobsPage, loadJobsByIds };
}

async function importHybridSearchWithTelemetryMocks() {
  vi.resetModules();

  const mockExecute = vi.fn().mockResolvedValue({
    rows: [{ id: "job-2", title: "Vector vacature", similarity: 0.74 }],
  });
  const mockWhere = vi.fn().mockResolvedValue([
    {
      id: "job-1",
      title: "Tekst vacature",
      company: "Motian",
      endClient: "Gemeente Utrecht",
      location: "Utrecht",
      province: "Utrecht",
      platform: "opdrachtoverheid",
    },
    {
      id: "job-2",
      title: "Vector vacature",
      company: "Motian",
      endClient: "Gemeente Utrecht",
      location: "Utrecht",
      province: "Utrecht",
      platform: "opdrachtoverheid",
    },
  ]);
  const mockSelect = vi.fn(() => ({ from: vi.fn(() => ({ where: mockWhere })) }));

  vi.doMock("../src/db", async () => ({
    ...(await import("../src/db")),
    db: {
      execute: mockExecute,
      select: mockSelect,
    },
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
  vi.doMock("drizzle-orm", () => ({
    and: (...args: unknown[]) => ({ type: "and", args }),
    ilike: (column: unknown, value: unknown) => ({ type: "ilike", column, value }),
    inArray: (column: unknown, values: unknown[]) => ({ type: "inArray", column, values }),
    or: (...args: unknown[]) => ({ type: "or", args }),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: "sql",
      strings,
      values,
    }),
  }));
  vi.doMock("../src/services/jobs/list", () => ({
    listJobs: vi.fn(),
  }));
  vi.doMock("../src/services/jobs/filters", () => ({
    getJobStatusCondition: vi.fn(() => ({ type: "status-condition" })),
    getSortComparator: vi.fn(() => () => 0),
  }));
  vi.doMock("../src/services/jobs/query-filters", () => ({
    buildJobFilterConditions: vi.fn(() => []),
  }));
  vi.doMock("../src/services/jobs/hybrid-search-policy", () => ({
    getHybridSearchPolicy: vi.fn(({ limit = 20, offset = 0 }) => ({
      version: 2,
      fetchSize: Math.min(Math.max((offset + limit) * 3, limit * 3), 100),
      k: 60,
      vectorMinScore: 0.3,
      hydrationMode: "deduped-vacancy-candidates",
      shouldRunVectorSearch: true,
      vectorSearchSkippedReason: null,
    })),
  }));
  vi.doMock("../src/services/jobs/repository", () => ({
    jobReadSelection: { id: "jobs.id" },
  }));
  vi.doMock("../src/services/jobs/deduplication", () => ({
    collapseScoredJobsByVacancy: vi.fn((entries: unknown[]) => entries),
    fetchDedupedJobIds: vi.fn().mockResolvedValue(["job-1"]),
    loadJobsByIds: vi.fn().mockResolvedValue([
      {
        id: "job-1",
        title: "Tekst vacature",
        company: "Motian",
        endClient: "Gemeente Utrecht",
        location: "Utrecht",
        province: "Utrecht",
        platform: "opdrachtoverheid",
      },
    ]),
  }));
  vi.doMock("../src/services/embedding", () => ({
    getQueryEmbeddingSignal: vi.fn((query: string) => ({
      normalizedQuery: query.trim().toLowerCase(),
      characterCount: query.trim().length,
      termCount: query.trim() ? query.trim().split(/\s+/).length : 0,
    })),
    generateQueryEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    findSimilarJobsByEmbedding: vi
      .fn()
      .mockResolvedValue([{ id: "job-2", title: "Vector vacature", similarity: 0.74 }]),
    findSimilarJobs: vi.fn(),
  }));

  const mod = await import("../src/services/jobs/search");
  return { hybridSearchWithTotal: mod.hybridSearchWithTotal, mockExecute, mockSelect };
}

describe("query-observability", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("exposes SLO thresholds as numbers", () => {
    expect(SEARCH_SLO_MS).toBe(800);
    expect(LIST_SLO_MS).toBe(500);
  });

  it("builds a stable structured payload", () => {
    expect(
      buildSlowQueryPayload("listJobs", 550, LIST_SLO_MS, {
        limit: 50,
        offset: 0,
      }),
    ).toEqual({
      operation: "listJobs",
      durationMs: 550,
      thresholdMs: LIST_SLO_MS,
      limit: 50,
      offset: 0,
    });
  });

  it("does not log when duration is under threshold", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logSlowQuery("hybridSearch", 100, SEARCH_SLO_MS);
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs when duration meets or exceeds threshold", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logSlowQuery("hybridSearch", 900, SEARCH_SLO_MS, { query: "test" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe("[slow-query]");
    expect(warn.mock.calls[0][1]).toContain("hybridSearch");
    expect(warn.mock.calls[0][1]).toContain("900");
  });

  it("emits structured telemetry keys for listJobs", async () => {
    createIncreasingNow(250);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { listJobs } = await importListJobsWithTelemetryMocks();

    await listJobs({ limit: 2, offset: 5 });

    expect(warn).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(warn.mock.calls[0][1])) as Record<string, unknown>;
    expect(payload).toMatchObject({
      operation: "listJobs",
      limit: 2,
      offset: 5,
      total: 2,
    });
    expect(payload.durationMs).toEqual(expect.any(Number));
    expect(payload.dedupePageMs).toEqual(expect.any(Number));
    expect(payload.hydrateMs).toEqual(expect.any(Number));
  });

  it("emits structured telemetry keys for hybridSearch", async () => {
    createIncreasingNow(150);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { hybridSearchWithTotal } = await importHybridSearchWithTelemetryMocks();

    await hybridSearchWithTotal("informatie", { limit: 1, offset: 0 });

    expect(warn).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(warn.mock.calls[0][1])) as Record<string, unknown>;
    expect(payload).toMatchObject({
      operation: "hybridSearch",
      query: "informatie",
      offset: 0,
      total: 2,
      results: 1,
      hydrationMode: "deduped-vacancy-candidates",
      vectorSearchEnabled: true,
      policyVersion: 2,
      candidateCount: 2,
      hydratedCandidates: 1,
    });
    expect(payload.durationMs).toEqual(expect.any(Number));
    expect(payload.textSearchMs).toEqual(expect.any(Number));
    expect(payload.embeddingMs).toEqual(expect.any(Number));
    expect(payload.vectorSearchMs).toEqual(expect.any(Number));
    expect(payload.rrfMs).toEqual(expect.any(Number));
    expect(payload.hydrateMs).toEqual(expect.any(Number));
    expect(payload.dedupeMs).toEqual(expect.any(Number));
  });
});
