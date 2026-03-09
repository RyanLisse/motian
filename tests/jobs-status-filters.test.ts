import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockCountWhere, mockDataWhere } = vi.hoisted(() => {
  const mockCountWhere = vi.fn().mockResolvedValue([{ count: 0 }]);
  const mockOffset = vi.fn().mockResolvedValue([]);
  const mockLimitWithOffset = vi.fn(() => ({ offset: mockOffset }));
  const mockOrderByWithOffset = vi.fn(() => ({ limit: mockLimitWithOffset }));
  const mockLimit = vi.fn().mockResolvedValue([]);
  const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));

  const mockDataWhere = vi.fn(() => ({
    orderBy: mockOrderBy,
    limit: mockLimit,
  }));

  const mockSelect = vi.fn((fields?: Record<string, unknown>) => ({
    from: vi.fn(() =>
      fields && "count" in fields
        ? { where: mockCountWhere }
        : { where: mockDataWhere, orderBy: mockOrderByWithOffset },
    ),
  }));

  return {
    mockCountWhere,
    mockDataWhere,
    mockDb: { select: mockSelect },
  };
});

vi.mock("../src/db", () => ({ db: mockDb }));
vi.mock("../src/db/schema", () => ({
  jobs: {
    id: "jobs.id",
    title: "jobs.title",
    company: "jobs.company",
    endClient: "jobs.endClient",
    description: "jobs.description",
    location: "jobs.location",
    province: "jobs.province",
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
    isNotNull: (column: unknown) => ({ type: "isNotNull", column }),
    isNull: (column: unknown) => ({ type: "isNull", column }),
    lte: (column: unknown, value: unknown) => ({ type: "lte", column, value }),
    ne: (column: unknown, value: unknown) => ({ type: "ne", column, value }),
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

describe("jobs service status and endClient filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCountWhere.mockResolvedValue([{ count: 0 }]);
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

    const whereClause = mockCountWhere.mock.calls[0]?.[0];
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
    expect(
      containsNode(
        whereClause,
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

    const whereClause = mockCountWhere.mock.calls[0]?.[0];
    expect(
      containsNode(
        whereClause,
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

    const whereClause = mockCountWhere.mock.calls[0]?.[0];
    expect(
      containsNode(
        whereClause,
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
        whereClause,
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

    const whereClause = mockCountWhere.mock.calls[0]?.[0];
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
    expect(
      containsNode(
        whereClause,
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
        whereClause,
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

  it("derives region filters from province-backed values", async () => {
    await listJobs({ region: "randstad" });

    const whereClause = mockCountWhere.mock.calls[0]?.[0];
    expect(
      containsNode(
        whereClause,
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
        whereClause,
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

    const whereClause = mockCountWhere.mock.calls[0]?.[0];
    expect(
      containsNode(
        whereClause,
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
        whereClause,
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
        whereClause,
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
