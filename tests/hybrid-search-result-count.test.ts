import { describe, expect, it } from "vitest";
import {
  getHybridSearchPolicy,
  HYBRID_SEARCH_MAX_REACHABLE_RESULTS,
} from "@/src/services/jobs/hybrid-search-policy";

const DEFAULT_LIMIT = 50;

/** Mirrors the clamp in app/api/vacatures/zoeken/route.ts. */
const advertisedPages = (total: number, limit: number) =>
  Math.ceil(Math.min(total, HYBRID_SEARCH_MAX_REACHABLE_RESULTS) / limit);

/**
 * Measured against production on 2026-09-04: every keyword query reported a
 * total of exactly `min(limit * 3, 100)` — 15 at limit=5, 30 at limit=10,
 * 100 at limit=50 — and `pagina=3` returned zero rows while still claiming
 * 100 results. The total was the retrieval window, never a count of matches.
 */
describe("hybrid search retrieval window", () => {
  it("keeps shallow pages cheap: page 1 still fetches only limit * 3", () => {
    const policy = getHybridSearchPolicy({ query: "developer", limit: DEFAULT_LIMIT, offset: 0 });

    expect(policy.fetchSize).toBe(150);
  });

  it("lets a caller page deeper than the old 100-row ceiling", () => {
    // Page 10 at 50 per page: offset 450 needs rows 450-500 to exist.
    const policy = getHybridSearchPolicy({ query: "developer", limit: DEFAULT_LIMIT, offset: 450 });

    expect(policy.fetchSize).toBe(500);
    expect(policy.fetchSize).toBeGreaterThanOrEqual(450 + DEFAULT_LIMIT);
  });

  it("never retrieves past the documented pre-fetch budget", () => {
    const policy = getHybridSearchPolicy({ query: "developer", limit: 100, offset: 10_000 });

    expect(policy.fetchSize).toBe(HYBRID_SEARCH_MAX_REACHABLE_RESULTS);
  });

  it("advertises only pages that can actually return rows", () => {
    // A broad query matching far more than the window may not offer 240 pages.
    expect(advertisedPages(12_000, DEFAULT_LIMIT)).toBe(10);

    // Every advertised page sits inside the retrieval window.
    const lastPageOffset = (advertisedPages(12_000, DEFAULT_LIMIT) - 1) * DEFAULT_LIMIT;
    expect(lastPageOffset + DEFAULT_LIMIT).toBeLessThanOrEqual(HYBRID_SEARCH_MAX_REACHABLE_RESULTS);
  });

  it("reports the real page count for result sets inside the window", () => {
    expect(advertisedPages(3, DEFAULT_LIMIT)).toBe(1);
    expect(advertisedPages(120, DEFAULT_LIMIT)).toBe(3);
  });

  it("decides to count separately exactly when the window filled up", () => {
    const policy = getHybridSearchPolicy({ query: "developer", limit: DEFAULT_LIMIT, offset: 0 });

    // Window not filled — everything matching was retrieved, count locally.
    expect(149 >= policy.fetchSize).toBe(false);
    // Window filled — an unknown number was truncated, ask the database.
    expect(150 >= policy.fetchSize).toBe(true);
  });
});
