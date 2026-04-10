import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockEnsureTypesenseCollections, mockGetHealth } = vi.hoisted(() => ({
  mockEnsureTypesenseCollections: vi.fn(),
  mockGetHealth: vi.fn(),
}));

vi.mock("@/src/services/search-index/typesense-client", () => ({
  ensureTypesenseCollections: mockEnsureTypesenseCollections,
}));

vi.mock("@/src/services/scrapers", () => ({
  getHealth: mockGetHealth,
}));

import { GET } from "../app/api/gezondheid/route";

describe("GET /api/gezondheid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHealth.mockResolvedValue({ overall: "gezond", data: [] });
  });

  it("boots Typesense collections before returning health", async () => {
    const response = await GET(new Request("http://localhost/api/gezondheid") as never);

    expect(mockEnsureTypesenseCollections).toHaveBeenCalledTimes(1);
    expect(mockGetHealth).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    await expect(response.json()).resolves.toEqual({ overall: "gezond", data: [] });
  });

  it("returns health even when Typesense bootstrap fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockEnsureTypesenseCollections.mockRejectedValueOnce(new Error("typesense offline"));

    const response = await GET(new Request("http://localhost/api/gezondheid") as never);

    expect(response.status).toBe(200);
    expect(mockGetHealth).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[Gezondheid] Typesense bootstrap mislukt:",
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });
});
