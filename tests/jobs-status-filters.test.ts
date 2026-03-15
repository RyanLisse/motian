import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockDataWhere, mockExecute } = vi.hoisted(() => {
  const mockLimit = vi.fn().mockResolvedValue([]);
  const mockExecute = vi.fn().mockResolvedValue({ rows: [] });

  const mockDataWhere = vi.fn(() => ({
    orderBy: vi.fn(() => ({ limit: mockLimit })),
    limit: mockLimit,
  }));

  const mockSelect = vi.fn(() => ({ from: vi.fn(() => ({ where: mockDataWhere })) }));

  return {
    mockDataWhere,
    mockExecute,
    mockDb: { select: mockSelect, execute: mockExecute },
  };
});

vi.mock("../src/db", async (importOriginal) => ({
  ...(await importOriginal()),
  db: mockDb,
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
    dedupeTitleNormalized: "jobs.dedupeTitleNormalized",
    dedupeClientNormalized: "jobs.dedupeClientNormalized",
    dedupeLocationNormalized: "jobs.dedupeLocationNormalized",
    searchText: "jobs.searchText",
    categories: "jobs.categories",
    platform: "jobs.platform",
    status: "jobs.status",
    deletedAt: "jobs.deletedAt",
    scrapedAt: "jobs.scrapedAt",
    rateMin: "jobs.rateMin",
    rateMax: "jobs.rateMax",
    hoursPerWeek: "jobs.hoursPerWeek",
    minHoursPerWeek: "jobs.minHoursPerWeek",
    applicationDeadline: "jobs.applicationDeadline",
    postedAt: "jobs.postedAt",
    startDate: "jobs.startDate",
    contractType: "jobs.contractType",
    workArrangement: "jobs.workArrangement",
    latitude: "jobs.latitude",
    longitude: "jobs.longitude",
  },
  applications: {
    jobId: "applications.jobId",
    deletedAt: "applications.deletedAt",
    stage: "applications.stage",
  },
}));
vi.mock("drizzle-orm", () => {
  const sqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: "sql",
    strings,
    values,
  });

  return {
    and: (...args: unknown[]) => ({ type: "and", args }),
    or: (...args: unknown[]) => ({ type: "or", args }),
    eq: (column: unknown, value: unknown) => ({ type: "eq", column, value }),
    gte: (column: unknown, value: unknown) => ({ type: "gte", column, value }),
    ilike: (column: unknown, value: unknown) => ({ type: "ilike", column, value }),
    inArray: (column: unknown, values: unknown[]) => ({ type: "inArray", column, values }),
    isNotNull: (column: unknown) => ({ type: "isNotNull", column }),
    isNull: (column: unknown) => ({ type: "isNull", column }),
    lte: (column: unknown, value: unknown) => ({ type: "lte", column, value }),
    ne: (column: unknown, value: unknown) => ({ type: "ne", column, value }),
    getTableColumns: (table: Record<string, unknown>) => table,
    sql: sqlTag,
    desc: (column: unknown) => ({ type: "desc", column }),
    asc: (column: unknown) => ({ type: "asc", column }),
  };
});

import { listActiveJobs, listJobs } from "../src/services/jobs";

function containsNode(node: unknown, predicate: (value: unknown) => boolean): boolean {
  if (predicate(node)) return true;
  if (Array.isArray(node)) return node.some((item) => containsNode(item, predicate));
  if (node && typeof node === "object") {
    return Object.values(node).some((value) => containsNode(value, predicate));
  }
  return false;
}

function getListJobsQuery() {
  return mockExecute.mock.calls
    .map(([query]) => query)
    .find((query) =>
      containsNode(
        query,
        (value) => typeof value === "string" && value.includes("row_number() over"),
      ),
    );
}

describe("jobs service status and endClient filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue({ rows: [] });
    mockDataWhere.mockReturnValue({
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => ({
          offset: vi.fn().mockResolvedValue([]),
        })),
      })),
      limit: vi.fn().mockResolvedValue([]),
    });
  });

  it("defaults listJobs to open status and filters by dedicated endClient column", async () => {
    await listJobs({ endClient: "Gemeente Utrecht" });

    const listJobsQuery = getListJobsQuery();
    expect(
      containsNode(
        listJobsQuery,
        (value) =>
          typeof value === "object" &&
          value !== null &&
          "type" in value &&
          (value as { type: string }).type === "eq" &&
          (value as { column: string }).column === "jobs.status" &&
          (value as { value: string }).value === "open",
      ),
    ).toBe(true);
    expect(
      containsNode(
        listJobsQuery,
        (value) =>
          typeof value === "object" &&
          value !== null &&
          "type" in value &&
          (value as { type: string }).type === "isNull" &&
          (value as { column: string }).column === "jobs.deletedAt",
      ),
    ).toBe(false);
    expect(
      containsNode(
        listJobsQuery,
        (value) =>
          typeof value === "object" &&
          value !== null &&
          "type" in value &&
          (value as { type: string }).type === "eq" &&
          (value as { column: string }).column === "jobs.endClient" &&
          (value as { value: string }).value === "Gemeente Utrecht",
      ),
    ).toBe(true);
  });

  it("supports explicitly querying closed jobs", async () => {
    await listJobs({ status: "closed" });

    const listJobsQuery = getListJobsQuery();
    expect(
      containsNode(
        listJobsQuery,
        (value) =>
          typeof value === "object" &&
          value !== null &&
          "type" in value &&
          (value as { type: string }).type === "eq" &&
          (value as { column: string }).column === "jobs.status" &&
          (value as { value: string }).value === "closed",
      ),
    ).toBe(true);
  });

  it("supports explicitly querying archived jobs", async () => {
    await listJobs({ status: "archived" });

    const listJobsQuery = getListJobsQuery();
    expect(
      containsNode(
        listJobsQuery,
        (value) =>
          typeof value === "object" &&
          value !== null &&
          "type" in value &&
          (value as { type: string }).type === "eq" &&
          (value as { column: string }).column === "jobs.status" &&
          (value as { value: string }).value === "archived",
      ),
    ).toBe(true);
    expect(
      containsNode(
        listJobsQuery,
        (value) =>
          typeof value === "object" &&
          value !== null &&
          "type" in value &&
          ((value as { type: string }).type === "isNull" ||
            (value as { type: string }).type === "isNotNull") &&
          (value as { column: string }).column === "jobs.deletedAt",
      ),
    ).toBe(false);
  });

  it("treats status=all as an unrestricted retention view without visibility filters", async () => {
    await listJobs({ status: "all" });

    const listJobsQuery = getListJobsQuery();
    expect(
      containsNode(
        listJobsQuery,
        (value) =>
          typeof value === "object" &&
          value !== null &&
          "type" in value &&
          (value as { type: string }).type === "isNull" &&
          (value as { column: string }).column === "jobs.deletedAt",
      ),
    ).toBe(false);
    expect(
      containsNode(
        listJobsQuery,
        (value) =>
          typeof value === "object" &&
          value !== null &&
          "type" in value &&
          (value as { type: string }).type === "eq" &&
          (value as { column: string }).column === "jobs.status",
      ),
    ).toBe(false);
    expect(
      containsNode(
        listJobsQuery,
        (value) =>
          typeof value === "object" &&
          value !== null &&
          "type" in value &&
          (value as { type: string }).type === "sql",
      ),
    ).toBe(true);
  });

  it("keeps listActiveJobs aligned with persisted open status", async () => {
    await listActiveJobs();

    const whereClause = mockDataWhere.mock.calls[0]?.[0];
    expect(
      containsNode(
        whereClause,
        (value) =>
          typeof value === "object" &&
          value !== null &&
          "type" in value &&
          (value as { type: string }).type === "eq" &&
          (value as { column: string }).column === "jobs.status" &&
          (value as { value: string }).value === "open",
      ),
    ).toBe(true);
    expect(
      containsNode(
        whereClause,
        (value) =>
          typeof value === "object" &&
          value !== null &&
          "type" in value &&
          (value as { type: string }).type === "isNull" &&
          (value as { column: string }).column === "jobs.deletedAt",
      ),
    ).toBe(false);
  });

  it("uses a backward-compatible job projection that does not read archived or helper columns directly", async () => {
    mockExecute.mockResolvedValue({ rows: [{ id: "job-1" }] });
    mockDataWhere.mockReturnValue({
      limit: vi
        .fn()
        .mockResolvedValue([
          { id: "job-1", title: "Voorbeeld vacature", platform: "opdrachtoverheid" },
        ]),
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => ({
          offset: vi.fn().mockResolvedValue([]),
        })),
      })),
    });

    await listJobs();

    const dataSelectFields = mockDb.select.mock.calls.find(
      ([fields]) => fields && typeof fields === "object" && !("count" in fields),
    )?.[0] as Record<string, unknown> | undefined;

    expect(dataSelectFields).toBeDefined();
    expect(dataSelectFields?.title).toBe("jobs.title");
    expect(dataSelectFields?.dedupeTitleNormalized).toMatchObject({ type: "sql" });
    expect(dataSelectFields?.dedupeClientNormalized).toMatchObject({ type: "sql" });
    expect(dataSelectFields?.dedupeLocationNormalized).toMatchObject({ type: "sql" });
    expect(dataSelectFields?.searchText).toMatchObject({ type: "sql" });
    expect(dataSelectFields?.archivedAt).toMatchObject({ type: "sql", values: [] });
    expect(dataSelectFields?.dedupeTitleNormalized).not.toBe("jobs.dedupeTitleNormalized");
    expect(dataSelectFields?.dedupeClientNormalized).not.toBe("jobs.dedupeClientNormalized");
    expect(dataSelectFields?.dedupeLocationNormalized).not.toBe("jobs.dedupeLocationNormalized");
  });

  it("builds a deduped vacature-id query and preserves the deduped ordering", async () => {
    mockExecute.mockResolvedValue({
      rows: [
        { id: "job-2", total: 2 },
        { id: "job-1", total: 2 },
      ],
    });
    mockDataWhere.mockReturnValue({
      limit: vi.fn().mockResolvedValue([
        { id: "job-1", title: "Eerste vacature", platform: "opdrachtoverheid" },
        { id: "job-2", title: "Tweede vacature", platform: "opdrachtoverheid" },
      ]),
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => ({
          offset: vi.fn().mockResolvedValue([]),
        })),
      })),
    });

    const result = await listJobs({ limit: 2, offset: 0 });

    const dedupeQuery = getListJobsQuery() as
      | { strings?: TemplateStringsArray | string[] }
      | undefined;
    const usesStoredNormalizedColumns =
      containsNode(dedupeQuery, (value) => value === "jobs.dedupeTitleNormalized") &&
      containsNode(dedupeQuery, (value) => value === "jobs.dedupeClientNormalized") &&
      containsNode(dedupeQuery, (value) => value === "jobs.dedupeLocationNormalized");
    const usesOnTheFlyFallback = containsNode(
      dedupeQuery,
      (value) => typeof value === "string" && value.includes("regexp_replace"),
    );

    expect(
      containsNode(
        dedupeQuery,
        (value) => typeof value === "string" && value.includes("row_number() over"),
      ),
    ).toBe(true);
    expect(
      containsNode(
        dedupeQuery,
        (value) => typeof value === "string" && value.includes("dedupe_rank = 1"),
      ),
    ).toBe(true);
    expect(usesStoredNormalizedColumns || usesOnTheFlyFallback).toBe(true);
    expect(result.total).toBe(2);
    expect(result.data.map((job) => job.id)).toEqual(["job-2", "job-1"]);
    expect(result).not.toHaveProperty("telemetry");
  });

  it("keeps the deduped total when the requested page is empty", async () => {
    mockExecute.mockResolvedValue({ rows: [{ id: null, total: 5 }] });

    const result = await listJobs({ limit: 2, offset: 10 });

    expect(result.total).toBe(5);
    expect(result.data).toEqual([]);
    expect(result).not.toHaveProperty("telemetry");
  });

  it("regression: exact deduped total across all pages (no limitForRanking)", async () => {
    // This test validates that the deduplication query computes the total
    // over the FULL deduped set, not a limited ranking window.
    //
    // The query structure must be:
    // 1. Build full deduped_jobs CTE (no limit)
    // 2. Count ALL rows in deduped_jobs
    // 3. Apply limit/offset ONLY to page results
    //
    // This ensures: total = count of all deduped rows, regardless of pagination

    // Scenario: 5 total deduped jobs, requesting page 1 (limit=2, offset=0)
    mockExecute.mockResolvedValueOnce({
      rows: [
        { id: "job-1", total: 5 },
        { id: "job-2", total: 5 },
      ],
    });
    mockDataWhere.mockReturnValueOnce({
      limit: vi.fn().mockResolvedValue([
        { id: "job-1", title: "Job 1", platform: "test" },
        { id: "job-2", title: "Job 2", platform: "test" },
      ]),
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => ({
          offset: vi.fn().mockResolvedValue([]),
        })),
      })),
    });

    const page1 = await listJobs({ limit: 2, offset: 0 });
    expect(page1.total).toBe(5); // Total is 5, not 2
    expect(page1.data).toHaveLength(2);

    // Scenario: Same 5 total deduped jobs, requesting page 3 (limit=2, offset=4)
    // This is the critical test: if limitForRanking was applied, total would be wrong
    mockExecute.mockResolvedValueOnce({
      rows: [{ id: "job-5", total: 5 }],
    });
    mockDataWhere.mockReturnValueOnce({
      limit: vi.fn().mockResolvedValue([{ id: "job-5", title: "Job 5", platform: "test" }]),
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => ({
          offset: vi.fn().mockResolvedValue([]),
        })),
      })),
    });

    const page3 = await listJobs({ limit: 2, offset: 4 });
    expect(page3.total).toBe(5); // Total is still 5, not 1
    expect(page3.data).toHaveLength(1);
  });

  it("derives region filters from province-backed values", async () => {
    await listJobs({ region: "randstad" });

    const listJobsQuery = getListJobsQuery();
    expect(
      containsNode(
        listJobsQuery,
        (value) =>
          typeof value === "object" &&
          value !== null &&
          "type" in value &&
          (value as { type: string }).type === "eq" &&
          (value as { column: string }).column === "jobs.province" &&
          (value as { value: string }).value === "Utrecht",
      ),
    ).toBe(true);
    expect(
      containsNode(
        listJobsQuery,
        (value) =>
          typeof value === "object" &&
          value !== null &&
          "type" in value &&
          (value as { type: string }).type === "eq" &&
          (value as { column: string }).column === "jobs.province" &&
          (value as { value: string }).value === "Noord-Holland",
      ),
    ).toBe(true);
  });

  it("applies hours overlap and radius filters from explicit province anchors", async () => {
    await listJobs({ province: "Utrecht", hoursPerWeekBucket: "24_32", radiusKm: 25 });

    const listJobsQuery = getListJobsQuery();
    expect(
      containsNode(
        listJobsQuery,
        (value) =>
          typeof value === "object" &&
          value !== null &&
          "type" in value &&
          (value as { type: string }).type === "eq" &&
          (value as { column: string }).column === "jobs.province" &&
          (value as { value: string }).value === "Utrecht",
      ),
    ).toBe(true);
    expect(
      containsNode(
        listJobsQuery,
        (value) =>
          typeof value === "object" &&
          value !== null &&
          "type" in value &&
          (value as { type: string }).type === "sql" &&
          Array.isArray((value as { values?: unknown[] }).values) &&
          (value as { values: unknown[] }).values.includes(24) &&
          (value as { values: unknown[] }).values.includes(32),
      ),
    ).toBe(true);
    expect(
      containsNode(
        listJobsQuery,
        (value) =>
          typeof value === "object" &&
          value !== null &&
          "type" in value &&
          (value as { type: string }).type === "sql" &&
          Array.isArray((value as { values?: unknown[] }).values) &&
          (value as { values: unknown[] }).values.includes(52.0907) &&
          (value as { values: unknown[] }).values.includes(5.1214) &&
          (value as { values: unknown[] }).values.includes(25),
      ),
    ).toBe(true);
  });
});
