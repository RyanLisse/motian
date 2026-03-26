import { beforeEach, describe, expect, it, vi } from "vitest";

const { jobs, mockDb } = vi.hoisted(() => ({
  jobs: {
    id: "jobs.id",
    scrapedAt: "jobs.scrapedAt",
    rateMax: "jobs.rateMax",
    rateMin: "jobs.rateMin",
    applicationDeadline: "jobs.applicationDeadline",
    postedAt: "jobs.postedAt",
    startDate: "jobs.startDate",
    dedupeTitleNormalized: "jobs.dedupeTitleNormalized",
    dedupeClientNormalized: "jobs.dedupeClientNormalized",
    dedupeLocationNormalized: "jobs.dedupeLocationNormalized",
    title: "jobs.title",
    company: "jobs.company",
    endClient: "jobs.endClient",
    location: "jobs.location",
    province: "jobs.province",
  },
  mockDb: {
    execute: vi.fn(),
    select: vi.fn(),
  },
}));

vi.mock("../src/db", async (importOriginal) => ({
  ...(await importOriginal()),
  db: mockDb,
}));
vi.mock("../src/db/schema", () => ({ jobs }));
vi.mock("../src/services/jobs/repository", () => ({ jobReadSelection: {} }));
vi.mock("drizzle-orm", () => {
  const sqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: "sql",
    strings,
    values,
  });

  sqlTag.raw = (value: string) => value;

  const stub = (...args: unknown[]) => ({ type: "stub", args });

  return {
    inArray: (column: unknown, values: unknown[]) => ({ type: "inArray", column, values }),
    sql: sqlTag,
    and: stub,
    asc: stub,
    desc: stub,
    eq: stub,
    getTableColumns: stub,
    gte: stub,
    like: stub,
    isNotNull: stub,
    isNull: stub,
    lt: stub,
    lte: stub,
    ne: stub,
    or: stub,
  };
});

function collectSqlTokens(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];

  const tokens: string[] = [];
  if ("strings" in value && Array.isArray(value.strings)) {
    tokens.push(...value.strings.map(String));
  }
  if ("values" in value && Array.isArray(value.values)) {
    for (const nested of value.values) {
      tokens.push(...collectSqlTokens(nested));
    }
  }
  return tokens;
}

function _createMissingColumnError(column = "dedupe_title_normalized") {
  return Object.assign(new Error(`column jobs.${column} does not exist`), {
    code: "42703",
    column,
  });
}

describe("job deduplication compatibility fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    mockDb.execute.mockReset();
    mockDb.select.mockReset();
  });

  // Dedupe columns are always present in schema - no fallback behavior
  it("uses normalized columns directly without checking schema", async () => {
    // With SQLite, we directly use the normalized columns - no schema check needed
    mockDb.execute.mockResolvedValueOnce({ rows: [{ id: "job-1", total: 1 }] });

    const { fetchDedupedJobsPage } = await import("../src/services/jobs/deduplication");
    const { sql } = await import("drizzle-orm");

    const page = await fetchDedupedJobsPage({ whereClause: sql`true`, limit: 10, offset: 0 });

    expect(page).toEqual({ ids: ["job-1"], total: 1 });
    // Only 1 call needed - no schema checks like PostgreSQL
    expect(mockDb.execute).toHaveBeenCalledTimes(1);

    const queryText = collectSqlTokens(mockDb.execute.mock.calls[0]?.[0]).join(" ");
    // SQLite uses normalized columns directly
    expect(queryText).toContain("jobs.dedupeTitleNormalized");
    expect(queryText).toContain("jobs.dedupeClientNormalized");
    expect(queryText).toContain("jobs.dedupeLocationNormalized");
  }, 15_000);

  it("returns empty results when no jobs match", async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [] });

    const { fetchDedupedJobsPage } = await import("../src/services/jobs/deduplication");
    const { sql } = await import("drizzle-orm");

    const page = await fetchDedupedJobsPage({ whereClause: sql`false`, limit: 10, offset: 0 });

    expect(page).toEqual({ ids: [], total: 0 });
    expect(mockDb.execute).toHaveBeenCalledTimes(1);
  }, 15_000);

  it("fetchDedupedJobIds returns id array using preFetch CTE path", async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [{ id: "job-1" }, { id: "job-2" }] });

    const { fetchDedupedJobIds } = await import("../src/services/jobs/deduplication");
    const { sql } = await import("drizzle-orm");

    const ids = await fetchDedupedJobIds({ whereClause: sql`true`, limit: 10, offset: 0 });

    expect(ids).toEqual(["job-1", "job-2"]);
    expect(mockDb.execute).toHaveBeenCalledTimes(1);

    const queryText = collectSqlTokens(mockDb.execute.mock.calls[0]?.[0]).join(" ");
    // preFetchLimit path uses pre_filtered CTE
    expect(queryText).toContain("pre_filtered");
  }, 15_000);

  it("fetchDedupedJobIds returns empty array when no results", async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [] });

    const { fetchDedupedJobIds } = await import("../src/services/jobs/deduplication");
    const { sql } = await import("drizzle-orm");

    const ids = await fetchDedupedJobIds({ whereClause: sql`false`, limit: 10 });

    expect(ids).toEqual([]);
    expect(mockDb.execute).toHaveBeenCalledTimes(1);
  }, 15_000);

  it("fetchDedupedJobIds uses sortBy order when provided", async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [{ id: "job-3" }] });

    const { fetchDedupedJobIds } = await import("../src/services/jobs/deduplication");
    const { sql } = await import("drizzle-orm");

    const ids = await fetchDedupedJobIds({
      whereClause: sql`true`,
      limit: 5,
      sortBy: "tarief_hoog",
    });

    expect(ids).toEqual(["job-3"]);
    expect(mockDb.execute).toHaveBeenCalledTimes(1);
  }, 15_000);
});
