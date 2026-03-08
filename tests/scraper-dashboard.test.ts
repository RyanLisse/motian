import { describe, expect, it } from "vitest";
import {
  buildListingOverlapGroups,
  derivePlatformHealth,
  type OverlapReference,
} from "../src/services/scraper-dashboard";

function createListing(
  overrides: Partial<OverlapReference> & Pick<OverlapReference, "id" | "platform">,
): OverlapReference {
  return {
    id: overrides.id,
    platform: overrides.platform,
    externalId: overrides.externalId ?? overrides.id,
    externalUrl: overrides.externalUrl ?? `https://example.com/${overrides.id}`,
    clientReferenceCode: overrides.clientReferenceCode ?? null,
    title: overrides.title ?? "Senior Java Developer",
    company: overrides.company ?? "Rabobank",
    endClient: overrides.endClient ?? null,
    location: overrides.location ?? "Utrecht",
    province: overrides.province ?? "Utrecht",
    postedAt: overrides.postedAt ?? new Date("2026-03-01T10:00:00Z"),
    applicationDeadline: overrides.applicationDeadline ?? new Date("2026-03-15T00:00:00Z"),
    startDate: overrides.startDate ?? new Date("2026-04-01T00:00:00Z"),
    scrapedAt: overrides.scrapedAt ?? new Date("2026-03-02T10:00:00Z"),
  };
}

describe("buildListingOverlapGroups", () => {
  it("groups cross-platform listings with exact title + organization + province", () => {
    const groups = buildListingOverlapGroups([
      createListing({ id: "job-1", platform: "striive" }),
      createListing({ id: "job-2", platform: "flextender" }),
      createListing({
        id: "job-3",
        platform: "opdrachtoverheid",
        province: "Noord-Holland",
        location: "Amsterdam",
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.strategy).toBe("title_organization_province");
    expect(groups[0]?.platforms).toEqual(["flextender", "striive"]);
    expect(groups[0]?.criteria).toContain("zelfde organisatie");
    expect(groups[0]?.listings.map((listing) => listing.id)).toEqual(["job-1", "job-2"]);
  });

  it("prefers client reference matches and keeps explainable shared values", () => {
    const groups = buildListingOverlapGroups([
      createListing({
        id: "job-1",
        platform: "striive",
        clientReferenceCode: "REF-42",
        company: null,
        endClient: "Belastingdienst",
        province: null,
        location: null,
      }),
      createListing({
        id: "job-2",
        platform: "flextender",
        clientReferenceCode: "REF-42",
        company: null,
        endClient: "Belastingdienst",
        province: null,
        location: null,
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.strategy).toBe("client_reference_title");
    expect(groups[0]?.sharedValues.clientReferenceCode).toBe("REF-42");
    expect(groups[0]?.criteria).toEqual([
      "zelfde genormaliseerde titel",
      "zelfde client referentiecode",
    ]);
  });

  it("does not group weak matches from one platform or title-only similarity", () => {
    const groups = buildListingOverlapGroups([
      createListing({ id: "job-1", platform: "striive", company: "Rabobank" }),
      createListing({ id: "job-2", platform: "striive", company: "Rabobank" }),
      createListing({ id: "job-3", platform: "flextender", company: "ING", province: "Utrecht" }),
    ]);

    expect(groups).toHaveLength(0);
  });
});

describe("derivePlatformHealth", () => {
  it("marks circuit breaker platforms as kritiek and overdue when next run passed", () => {
    const result = derivePlatformHealth({
      isActive: true,
      lastRunAt: new Date("2026-03-07T00:00:00Z"),
      lastRunStatus: "failed",
      nextRunAt: new Date("2026-03-07T04:00:00Z"),
      consecutiveFailures: 5,
      circuitBreakerOpen: true,
      recent24h: {
        runs: 3,
        successCount: 0,
        partialCount: 0,
        failedCount: 3,
        successRate: 0,
        avgDurationMs: 0,
      },
      latestError: "Timeout bij inloggen",
      now: new Date("2026-03-08T10:00:00Z"),
    });

    expect(result.status).toBe("kritiek");
    expect(result.isOverdue).toBe(true);
    expect(result.signals.map((signal) => signal.code)).toEqual(
      expect.arrayContaining(["circuit_breaker_open", "schedule_overdue", "recent_failures"]),
    );
  });

  it("returns inactief for disabled scrapers", () => {
    const result = derivePlatformHealth({
      isActive: false,
      lastRunAt: null,
      lastRunStatus: null,
      nextRunAt: null,
      consecutiveFailures: 0,
      circuitBreakerOpen: false,
      recent24h: {
        runs: 0,
        successCount: 0,
        partialCount: 0,
        failedCount: 0,
        successRate: 0,
        avgDurationMs: 0,
      },
      latestError: null,
    });

    expect(result.status).toBe("inactief");
    expect(result.signals).toEqual([
      { level: "info", code: "inactive", message: "Scraper is uitgeschakeld." },
    ]);
  });
});
