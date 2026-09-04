import { describe, expect, it, vi } from "vitest";
import {
  HYBRID_SEARCH_EMBEDDING_TIMEOUT_MS,
  withQueryEmbeddingTimeout,
} from "@/src/services/jobs/hybrid-search-policy";

/**
 * Regression guard for the 2026-09-04 production incident: the multi-word query
 * "senior java developer" held the /api/vacatures/zoeken response open for 232s
 * because the query-embedding call has no timeout and no AbortSignal, while
 * single-word queries (which skip the vector branch) returned in ~1.5s.
 */
describe("withQueryEmbeddingTimeout", () => {
  it("resolves with the embedding when the call finishes inside the budget", async () => {
    const embedding = [0.1, 0.2, 0.3];

    await expect(withQueryEmbeddingTimeout(() => Promise.resolve(embedding), 50)).resolves.toBe(
      embedding,
    );
  });

  it("rejects once the budget elapses instead of waiting for a hanging call", async () => {
    vi.useFakeTimers();
    try {
      // A call that never settles — the shape of the 232s production hang.
      const pending = withQueryEmbeddingTimeout(() => new Promise<number[]>(() => {}), 2500);
      const assertion = expect(pending).rejects.toThrow(/exceeded 2500ms budget/);

      await vi.advanceTimersByTimeAsync(2500);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("propagates the original failure rather than masking it as a timeout", async () => {
    const upstream = new Error("OpenAI 429");

    await expect(withQueryEmbeddingTimeout(() => Promise.reject(upstream), 50)).rejects.toBe(
      upstream,
    );
  });

  it("does not leave the timer pending after the call resolves", async () => {
    vi.useFakeTimers();
    try {
      const clearSpy = vi.spyOn(globalThis, "clearTimeout");
      await withQueryEmbeddingTimeout(() => Promise.resolve([1]), 5000);
      expect(clearSpy).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("defaults to a budget well under the observed 232s hang", () => {
    expect(HYBRID_SEARCH_EMBEDDING_TIMEOUT_MS).toBeLessThanOrEqual(3000);
  });
});
