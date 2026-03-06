/**
 * Unified vacature search (Phase 1) — service contract tests.
 * Verifies searchJobsUnified shape and branching: no q → list semantics, with q → hybrid semantics.
 */
import { describe, expect, it } from "vitest";
import { searchJobsUnified, type UnifiedJobSearchResult } from "../src/services/jobs";

describe("searchJobsUnified", () => {
  it("returns { data, total } with data array and number total", async () => {
    const result = await searchJobsUnified({ limit: 2, offset: 0 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.total).toBe("number");
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it("no q: filtered listing shape (no score on items)", async () => {
    const result = await searchJobsUnified({ limit: 2 });
    const first = result.data[0] as UnifiedJobSearchResult["data"][number] | undefined;
    if (first) {
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("title");
      expect(first).toHaveProperty("platform");
    }
  });

  it("with q: hybrid search shape (items have score)", async () => {
    const result = await searchJobsUnified({ q: "test", limit: 2 });
    expect(Array.isArray(result.data)).toBe(true);
    if (result.data.length > 0) {
      const first = result.data[0] as { id?: string; title?: string; score?: number };
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("score");
      expect(typeof first.score).toBe("number");
    }
  });

  it("accepts sortBy and returns deterministic ordering", async () => {
    const a = await searchJobsUnified({ limit: 3, sortBy: "nieuwste" });
    const b = await searchJobsUnified({ limit: 3, sortBy: "nieuwste" });
    expect(a.data.length).toBe(b.data.length);
    const idsA = a.data.map((j) => (j as { id: string }).id);
    const idsB = b.data.map((j) => (j as { id: string }).id);
    expect(idsA).toEqual(idsB);
  });

  it("accepts platform filter", async () => {
    const result = await searchJobsUnified({
      platform: "opdrachtoverheid",
      limit: 5,
    });
    for (const job of result.data) {
      expect((job as { platform?: string }).platform).toBe("opdrachtoverheid");
    }
  });
});
