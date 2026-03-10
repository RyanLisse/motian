import { describe, expect, it } from "vitest";
import {
  getHybridSearchPolicy,
  HYBRID_SEARCH_FULL_CANDIDATE_HYDRATION_ENV,
  HYBRID_SEARCH_SHORT_QUERY_TEXT_ONLY_ENV,
} from "../src/services/jobs/hybrid-search-policy";

describe("hybrid search short-query policy", () => {
  it("keeps short queries eligible for vector retrieval by default", () => {
    const policy = getHybridSearchPolicy({ query: "in", limit: 20, offset: 0 }, {});

    expect(policy.shouldRunVectorSearch).toBe(true);
    expect(policy.vectorSearchSkippedReason).toBeNull();
    expect(policy.hydrationMode).toBe("deduped-vacancy-candidates");
  });

  it("supports opting short queries into text-only retrieval via env flag", () => {
    const policy = getHybridSearchPolicy(
      { query: "in", limit: 20, offset: 0 },
      { [HYBRID_SEARCH_SHORT_QUERY_TEXT_ONLY_ENV]: "true" },
    );

    expect(policy.shouldRunVectorSearch).toBe(false);
    expect(policy.vectorSearchSkippedReason).toBe("short-query-text-only");
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

  it("re-enables vector retrieval once the normalized query reaches the minimum length", () => {
    const policy = getHybridSearchPolicy({ query: "xxxx", limit: 5, offset: 0 }, {});

    expect(policy.shouldRunVectorSearch).toBe(true);
    expect(policy.vectorSearchSkippedReason).toBeNull();
  });
});
