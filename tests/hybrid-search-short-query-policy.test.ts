import { describe, expect, it } from "vitest";
import {
  getHybridSearchPolicy,
  HYBRID_SEARCH_FULL_CANDIDATE_HYDRATION_ENV,
} from "../src/services/jobs/hybrid-search-policy";

describe("hybrid search short-query policy", () => {
  it("skips vector search for single-word queries", () => {
    const policy = getHybridSearchPolicy({ query: "java", limit: 20, offset: 0 }, {});

    expect(policy.shouldRunVectorSearch).toBe(false);
    expect(policy.vectorSearchSkippedReason).toBe("short-query-text-only");
  });

  it("skips vector search for two-word queries", () => {
    const policy = getHybridSearchPolicy(
      { query: "python developer", limit: 20, offset: 0 },
      {},
    );

    expect(policy.shouldRunVectorSearch).toBe(false);
    expect(policy.vectorSearchSkippedReason).toBe("short-query-text-only");
  });

  it("enables vector search for three-or-more-word queries", () => {
    const policy = getHybridSearchPolicy(
      { query: "ervaren data engineer financiële sector", limit: 20, offset: 0 },
      {},
    );

    expect(policy.shouldRunVectorSearch).toBe(true);
    expect(policy.vectorSearchSkippedReason).toBeNull();
  });

  it("keeps deduped vacancy hydration and the current fetch-size branch", () => {
    const policy = getHybridSearchPolicy({ query: "informatie", limit: 10, offset: 5 }, {});

    expect(policy.hydrationMode).toBe("deduped-vacancy-candidates");
    expect(policy.fetchSize).toBe(45);
  });

  it("supports reverting to full candidate hydration via env flag", () => {
    const policy = getHybridSearchPolicy(
      { query: "informatie", limit: 10, offset: 5 },
      { [HYBRID_SEARCH_FULL_CANDIDATE_HYDRATION_ENV]: "1" },
    );

    expect(policy.hydrationMode).toBe("full-candidates");
  });

  it("skips vector search for empty queries", () => {
    const policy = getHybridSearchPolicy({ query: "", limit: 20, offset: 0 }, {});

    // Empty query = no words = not short, vector search is fine (it's a list)
    expect(policy.shouldRunVectorSearch).toBe(true);
  });
});
