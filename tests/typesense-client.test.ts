import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetTypesenseConfig } = vi.hoisted(() => ({
  mockGetTypesenseConfig: vi.fn(),
}));

vi.mock("../src/lib/typesense", () => ({
  getTypesenseConfig: mockGetTypesenseConfig,
}));

import {
  ensureTypesenseCollection,
  isTypesenseCollectionKnownMissing,
  markTypesenseCollectionMissing,
  resetTypesenseCollectionCache,
} from "../src/services/search-index/typesense-client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("typesense client bootstrap cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTypesenseCollectionCache();
    mockGetTypesenseConfig.mockReturnValue({
      url: "https://typesense.example.com",
      apiKey: "secret-key",
      collections: {
        jobs: "motian_jobs_preview",
        candidates: "motian_candidates_preview",
      },
    });
  });

  afterEach(() => {
    resetTypesenseCollectionCache();
    vi.unstubAllGlobals();
  });

  it("caches successful collection existence checks across repeated bootstraps", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ name: "motian_jobs_preview" }));
    vi.stubGlobal("fetch", fetchMock);

    await ensureTypesenseCollection("jobs");
    await ensureTypesenseCollection("jobs");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(isTypesenseCollectionKnownMissing("jobs")).toBe(false);
  });

  it("allows explicit bootstrap to recover after a collection was previously marked missing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(jsonResponse({ name: "motian_jobs_preview" }, 201));
    vi.stubGlobal("fetch", fetchMock);

    markTypesenseCollectionMissing("jobs");
    expect(isTypesenseCollectionKnownMissing("jobs")).toBe(true);

    await ensureTypesenseCollection("jobs");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(isTypesenseCollectionKnownMissing("jobs")).toBe(false);
  });
});
