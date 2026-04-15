import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetHealth } = vi.hoisted(() => ({
  mockGetHealth: vi.fn(),
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

  it("returns health with cache-control disabled", async () => {
    const response = await GET(new Request("http://localhost/api/gezondheid") as never);

    expect(mockGetHealth).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    await expect(response.json()).resolves.toEqual({ overall: "gezond", data: [] });
  });
});
