import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetEnrichmentStatus } = vi.hoisted(() => ({
  mockGetEnrichmentStatus: vi.fn(),
}));

vi.mock("@/src/services/enrichment-status", () => ({
  getEnrichmentStatus: mockGetEnrichmentStatus,
}));

import { GET } from "../app/api/enrichment-status/route";

describe("GET /api/enrichment-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns enrichment status payload with jobs, candidates, and timestamp", async () => {
    const fixedTimestamp = "2026-04-24T12:00:00.000Z";
    mockGetEnrichmentStatus.mockResolvedValue({
      jobs: { missingSummary: 65_237, missingEmbedding: 42_897, total: 100_000 },
      candidates: { missingEmbedding: 1_234, total: 5_678 },
      timestamp: fixedTimestamp,
    });

    const response = await GET(new Request("http://localhost/api/enrichment-status") as never);

    expect(mockGetEnrichmentStatus).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      jobs: { missingSummary: number; missingEmbedding: number; total: number };
      candidates: { missingEmbedding: number; total: number };
      timestamp: string;
    };
    expect(body.jobs.missingSummary).toBe(65_237);
    expect(body.jobs.missingEmbedding).toBe(42_897);
    expect(body.jobs.total).toBe(100_000);
    expect(body.candidates.missingEmbedding).toBe(1_234);
    expect(body.candidates.total).toBe(5_678);
    expect(body.timestamp).toBe(fixedTimestamp);
  });

  it("returns 500 with Dutch error message when service throws", async () => {
    mockGetEnrichmentStatus.mockRejectedValue(new Error("db down"));

    const response = await GET(new Request("http://localhost/api/enrichment-status") as never);

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/verrijking/i);
  });
});
