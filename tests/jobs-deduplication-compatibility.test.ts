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

function createMissingColumnError(column = "dedupe_title_normalized") {
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

  it("uses on-the-fly normalized expressions when dedupe columns are unavailable", async () => {
    mockDb.execute
      .mockResolvedValueOnce({ rows: [{ present_count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ id: "job-1", total: 1 }] });

    const { fetchDedupedJobsPage } = await import("../src/services/jobs/deduplication");
    const { sql } = await import("drizzle-orm");

    const page = await fetchDedupedJobsPage({ whereClause: sql`true`, limit: 10, offset: 0 });

    expect(page).toEqual({ ids: ["job-1"], total: 1 });
    expect(mockDb.execute).toHaveBeenCalledTimes(2);

    const queryText = collectSqlTokens(mockDb.execute.mock.calls[1]?.[0]).join(" ");
    expect(queryText).toContain("jobs.title");
    expect(queryText).toContain("jobs.endClient");
    expect(queryText).toContain("jobs.company");
    expect(queryText).toContain("jobs.province");
    expect(queryText).toContain("jobs.location");
    expect(queryText).not.toContain("jobs.dedupeTitleNormalized");
    expect(queryText).not.toContain("jobs.dedupeClientNormalized");
    expect(queryText).not.toContain("jobs.dedupeLocationNormalized");
  });

  it("stays on legacy expressions when dedupe helper columns still need backfill", async () => {
    mockDb.execute
      .mockResolvedValueOnce({ rows: [{ present_count: 3 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "job-1", total: 1 }] });

    const { fetchDedupedJobsPage } = await import("../src/services/jobs/deduplication");
    const { sql } = await import("drizzle-orm");

    const page = await fetchDedupedJobsPage({ whereClause: sql`true`, limit: 10, offset: 0 });

    expect(page).toEqual({ ids: ["job-1"], total: 1 });
    expect(mockDb.execute).toHaveBeenCalledTimes(3);

    const readinessQueryText = collectSqlTokens(mockDb.execute.mock.calls[1]?.[0]).join(" ");
    expect(readinessQueryText).toContain("information_schema.tables");
    expect(readinessQueryText).toContain("__drizzle_migrations");
    expect(readinessQueryText).not.toContain("from jobs");

    const queryText = collectSqlTokens(mockDb.execute.mock.calls[2]?.[0]).join(" ");
    expect(queryText).toContain("jobs.title");
    expect(queryText).toContain("jobs.endClient");
    expect(queryText).toContain("jobs.company");
    expect(queryText).not.toContain("jobs.dedupeTitleNormalized");
    expect(queryText).not.toContain("jobs.dedupeClientNormalized");
    expect(queryText).not.toContain("jobs.dedupeLocationNormalized");
  });

  it("uses normalized helper columns when dedupe helper columns are backfilled", async () => {
    mockDb.execute
      .mockResolvedValueOnce({ rows: [{ present_count: 3 }] })
      .mockResolvedValueOnce({ rows: [{ table_schema: "drizzle" }] })
      .mockResolvedValueOnce({ rows: [{ migration_applied: true }] })
      .mockResolvedValueOnce({ rows: [{ id: "job-1", total: 1 }] });

    const { fetchDedupedJobsPage } = await import("../src/services/jobs/deduplication");
    const { sql } = await import("drizzle-orm");

    const page = await fetchDedupedJobsPage({ whereClause: sql`true`, limit: 10, offset: 0 });

    expect(page).toEqual({ ids: ["job-1"], total: 1 });
    expect(mockDb.execute).toHaveBeenCalledTimes(4);

    const readinessQueryText = collectSqlTokens(mockDb.execute.mock.calls[2]?.[0]).join(" ");
    expect(readinessQueryText).toContain("drizzle");
    expect(readinessQueryText).toContain("__drizzle_migrations");
    expect(readinessQueryText).toContain("migration_applied");
    expect(readinessQueryText).toContain(
      "de9573fb28a78df406df11f368ea0972f5ad11251dc6864791ba5b354f59768d",
    );

    const queryText = collectSqlTokens(mockDb.execute.mock.calls[3]?.[0]).join(" ");
    expect(queryText).toContain("jobs.dedupeTitleNormalized");
    expect(queryText).toContain("jobs.dedupeClientNormalized");
    expect(queryText).toContain("jobs.dedupeLocationNormalized");
    expect(queryText).not.toContain("jobs.endClient");
    expect(queryText).not.toContain("jobs.company");
    expect(queryText).not.toContain("jobs.province");
    expect(queryText).not.toContain("jobs.location");
  });

  it("stays on legacy expressions when the backfill migration hash is not recorded", async () => {
    mockDb.execute
      .mockResolvedValueOnce({ rows: [{ present_count: 3 }] })
      .mockResolvedValueOnce({ rows: [{ table_schema: "drizzle" }] })
      .mockResolvedValueOnce({ rows: [{ migration_applied: false }] })
      .mockResolvedValueOnce({ rows: [{ id: "job-1", total: 1 }] });

    const { fetchDedupedJobsPage } = await import("../src/services/jobs/deduplication");
    const { sql } = await import("drizzle-orm");

    const page = await fetchDedupedJobsPage({ whereClause: sql`true`, limit: 10, offset: 0 });

    expect(page).toEqual({ ids: ["job-1"], total: 1 });
    expect(mockDb.execute).toHaveBeenCalledTimes(4);

    const queryText = collectSqlTokens(mockDb.execute.mock.calls[3]?.[0]).join(" ");
    expect(queryText).toContain("jobs.title");
    expect(queryText).toContain("jobs.endClient");
    expect(queryText).not.toContain("jobs.dedupeTitleNormalized");
    expect(queryText).not.toContain("jobs.dedupeClientNormalized");
    expect(queryText).not.toContain("jobs.dedupeLocationNormalized");
  });

  it("caches legacy mode after the first missing-column failure across deduped queries", async () => {
    mockDb.execute
      .mockResolvedValueOnce({ rows: [{ present_count: 3 }] })
      .mockResolvedValueOnce({ rows: [{ table_schema: "drizzle" }] })
      .mockResolvedValueOnce({ rows: [{ migration_applied: true }] })
      .mockRejectedValueOnce(createMissingColumnError())
      .mockResolvedValueOnce({ rows: [{ id: "job-1", total: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: "job-2" }] });

    const { fetchDedupedJobIds, fetchDedupedJobsPage } = await import(
      "../src/services/jobs/deduplication"
    );
    const { sql } = await import("drizzle-orm");

    const firstPage = await fetchDedupedJobsPage({ whereClause: sql`true`, limit: 5, offset: 0 });
    const secondIds = await fetchDedupedJobIds({ whereClause: sql`true`, limit: 5, offset: 0 });

    expect(firstPage).toEqual({ ids: ["job-1"], total: 1 });
    expect(secondIds).toEqual(["job-2"]);
    expect(mockDb.execute).toHaveBeenCalledTimes(6);

    const queryText = collectSqlTokens(mockDb.execute.mock.calls[5]?.[0]).join(" ");
    expect(queryText).toContain("jobs.title");
    expect(queryText).toContain("jobs.endClient");
    expect(queryText).not.toContain("jobs.dedupeTitleNormalized");
    expect(queryText).not.toContain("jobs.dedupeClientNormalized");
    expect(queryText).not.toContain("jobs.dedupeLocationNormalized");
  });
});
