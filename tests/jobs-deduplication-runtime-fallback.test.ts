import { afterEach, describe, expect, it, vi } from "vitest";

async function loadDeduplicationModule(mockExecute: ReturnType<typeof vi.fn>) {
  vi.doMock("../src/db", async () => ({
    ...(await vi.importActual("../src/db")),
    db: { execute: mockExecute },
  }));
  vi.doMock("../src/db/schema", () => ({
    jobs: {
      id: "jobs.id",
      title: "jobs.title",
      company: "jobs.company",
      endClient: "jobs.end_client",
      location: "jobs.location",
      province: "jobs.province",
      scrapedAt: "jobs.scraped_at",
      rateMin: "jobs.rate_min",
      rateMax: "jobs.rate_max",
      applicationDeadline: "jobs.application_deadline",
      postedAt: "jobs.posted_at",
      startDate: "jobs.start_date",
      dedupeTitleNormalized: "jobs.dedupe_title_normalized",
      dedupeClientNormalized: "jobs.dedupe_client_normalized",
      dedupeLocationNormalized: "jobs.dedupe_location_normalized",
    },
  }));
  vi.doMock("drizzle-orm", () => {
    const stub = (...args: unknown[]) => ({ type: "stub", args });
    return {
      inArray: (...args: unknown[]) => ({ type: "inArray", args }),
      sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
        type: "sql",
        strings,
        values,
      }),
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
  vi.doMock("../src/services/jobs/repository", () => ({ jobReadSelection: {} }));

  return import("../src/services/jobs/deduplication");
}

describe("jobs deduplication runtime fallback", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unmock("../src/db");
    vi.unmock("../src/db/schema");
    vi.unmock("drizzle-orm");
    vi.unmock("../src/services/jobs/repository");
  });

  // SQLite/Turso: No runtime fallback - columns always exist in schema
  it("uses normalized columns directly without fallback", async () => {
    const mockExecute = vi.fn().mockResolvedValueOnce({ rows: [{ id: "job-1", total: 1 }] });
    const { fetchDedupedJobsPage } = await loadDeduplicationModule(mockExecute);

    const page = await fetchDedupedJobsPage({
      whereClause: { type: "sql", strings: ["true"], values: [] } as never,
      limit: 1,
    });

    expect(page).toEqual({ ids: ["job-1"], total: 1 });
    // No retry/fallback needed - SQLite always has the columns
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("returns empty when no jobs found", async () => {
    const mockExecute = vi.fn().mockResolvedValueOnce({ rows: [] });
    const { fetchDedupedJobsPage } = await loadDeduplicationModule(mockExecute);

    const page = await fetchDedupedJobsPage({
      whereClause: { type: "sql", strings: ["false"], values: [] } as never,
      limit: 1,
    });

    expect(page).toEqual({ ids: [], total: 0 });
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });
});
