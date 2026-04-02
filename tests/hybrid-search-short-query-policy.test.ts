import { describe, expect, it } from "vitest";
import {
  getHybridSearchPolicy,
  HYBRID_SEARCH_FORCE_VECTOR_ENV,
  HYBRID_SEARCH_FULL_CANDIDATE_HYDRATION_ENV,
  HYBRID_SEARCH_POLICY_VERSION,
} from "../src/services/jobs/hybrid-search-policy";

describe("hybrid search short-query policy", () => {
  it("is at policy version 3", () => {
    expect(HYBRID_SEARCH_POLICY_VERSION).toBe(3);
  });

  it("skips vector search for single-word queries", () => {
    const policy = getHybridSearchPolicy({ query: "java", limit: 20, offset: 0 }, {});

    expect(policy.shouldRunVectorSearch).toBe(false);
    expect(policy.vectorSearchSkippedReason).toBe("short-query-text-only");
  });

  it("enables vector search for two-word queries (Dutch synonym matching)", () => {
    const policy = getHybridSearchPolicy({ query: "project manager", limit: 20, offset: 0 }, {});

    expect(policy.shouldRunVectorSearch).toBe(true);
    expect(policy.vectorSearchSkippedReason).toBeNull();
  });

  it("enables vector search for exactly three words", () => {
    const policy = getHybridSearchPolicy(
      { query: "senior java developer", limit: 20, offset: 0 },
      {},
    );

    expect(policy.shouldRunVectorSearch).toBe(true);
    expect(policy.vectorSearchSkippedReason).toBeNull();
  });

  it("enables vector search for longer descriptive queries", () => {
    const policy = getHybridSearchPolicy(
      { query: "ervaren data engineer financiële sector", limit: 20, offset: 0 },
      {},
    );

    expect(policy.shouldRunVectorSearch).toBe(true);
    expect(policy.vectorSearchSkippedReason).toBeNull();
  });

  it("normalizes multi-space and tab queries correctly", () => {
    const policy = getHybridSearchPolicy({ query: "  java  ", limit: 20, offset: 0 }, {});
    expect(policy.shouldRunVectorSearch).toBe(false);

    const tabPolicy = getHybridSearchPolicy({ query: "java\tdeveloper", limit: 20, offset: 0 }, {});
    expect(tabPolicy.shouldRunVectorSearch).toBe(true); // 2 words after normalization
  });

  it("handles hyphenated terms as single words", () => {
    // "ICT-beheerder" is 1 word → keyword only
    const policy = getHybridSearchPolicy({ query: "ICT-beheerder", limit: 20, offset: 0 }, {});
    expect(policy.shouldRunVectorSearch).toBe(false);

    // "full-stack developer" is 2 words → hybrid
    const fsPolicy = getHybridSearchPolicy(
      { query: "full-stack developer", limit: 20, offset: 0 },
      {},
    );
    expect(fsPolicy.shouldRunVectorSearch).toBe(true);
  });

  it("allows empty queries to use vector search", () => {
    const policy = getHybridSearchPolicy({ query: "", limit: 20, offset: 0 }, {});

    expect(policy.shouldRunVectorSearch).toBe(true);
    expect(policy.vectorSearchSkippedReason).toBeNull();
  });

  it("supports HYBRID_SEARCH_FORCE_VECTOR kill switch to override skip", () => {
    const policy = getHybridSearchPolicy(
      { query: "java", limit: 20, offset: 0 },
      { [HYBRID_SEARCH_FORCE_VECTOR_ENV]: "true" },
    );

    // Force vector overrides the short-query skip
    expect(policy.shouldRunVectorSearch).toBe(true);
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
});
