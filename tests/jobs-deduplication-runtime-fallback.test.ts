import { afterEach, describe, expect, it, vi } from "vitest";

function collectStringLeaves(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStringLeaves);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectStringLeaves);
  return [];
}

async function loadDeduplicationModule(mockExecute: ReturnType<typeof vi.fn>) {
  vi.doMock("../src/db", () => ({ db: { execute: mockExecute } }));
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
  vi.doMock("drizzle-orm", () => ({
    inArray: (...args: unknown[]) => ({ type: "inArray", args }),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: "sql",
      strings,
      values,
    }),
  }));
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

  it("retries paged dedupe queries with derived normalization when persisted columns are missing", async () => {
    const mockExecute = vi
      .fn()
      .mockRejectedValueOnce(new Error("column jobs.dedupe_title_normalized does not exist"))
      .mockResolvedValueOnce({ rows: [{ id: "job-1", total: 1 }] });
    const { fetchDedupedJobsPage } = await loadDeduplicationModule(mockExecute);

    await expect(
      fetchDedupedJobsPage({
        whereClause: { type: "sql", strings: ["true"], values: [] } as never,
        limit: 1,
      }),
    ).resolves.toEqual({ ids: ["job-1"], total: 1 });

    const fallbackQuery = mockExecute.mock.calls[1]?.[0];
    const fallbackStrings = collectStringLeaves(fallbackQuery);

    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(fallbackStrings).toContain("jobs.title");
    expect(fallbackStrings).toContain("jobs.end_client");
    expect(fallbackStrings).toContain("jobs.company");
    expect(fallbackStrings).toContain("jobs.province");
    expect(fallbackStrings).toContain("jobs.location");
    expect(fallbackStrings.some((value) => value.includes("regexp_replace"))).toBe(true);
    expect(fallbackStrings.some((value) => value.includes("coalesce("))).toBe(true);
  });

  it("retries id lookups with derived normalization when persisted columns are missing", async () => {
    const mockExecute = vi
      .fn()
      .mockRejectedValueOnce(new Error("column jobs.dedupe_client_normalized does not exist"))
      .mockResolvedValueOnce({ rows: [{ id: "job-2" }] });
    const { fetchDedupedJobIds } = await loadDeduplicationModule(mockExecute);

    await expect(
      fetchDedupedJobIds({
        whereClause: { type: "sql", strings: ["true"], values: [] } as never,
        limit: 1,
      }),
    ).resolves.toEqual(["job-2"]);

    expect(mockExecute).toHaveBeenCalledTimes(2);
  });
});
