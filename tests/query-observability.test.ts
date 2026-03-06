import { afterEach, describe, expect, it, vi } from "vitest";
import { LIST_SLO_MS, logSlowQuery, SEARCH_SLO_MS } from "../src/lib/query-observability";

describe("query-observability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes SLO thresholds as numbers", () => {
    expect(SEARCH_SLO_MS).toBe(800);
    expect(LIST_SLO_MS).toBe(500);
  });

  it("does not log when duration is under threshold", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logSlowQuery("hybridSearch", 100, SEARCH_SLO_MS);
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs when duration meets or exceeds threshold", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logSlowQuery("hybridSearch", 900, SEARCH_SLO_MS, { query: "test" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe("[slow-query]");
    expect(warn.mock.calls[0][1]).toContain("hybridSearch");
    expect(warn.mock.calls[0][1]).toContain("900");
  });
});
